/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.cpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:46 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/31 02:16:20 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/app.hpp"

#include <spdlog/spdlog.h>
#include <cmath>
#include <numbers>
#include <unordered_set>

#ifdef __EMSCRIPTEN__
#include "game/protocol/schemas/state_generated.h"
#include "game/protocol/schemas/packet_ids_generated.h"
#endif

#include "game/renderer.hpp"
#include "glm/geometric.hpp"

namespace game::core {

#ifdef __EMSCRIPTEN__
void App::receive_frame(const protocol::Frame &frame)
{
    if (frame.channel != protocol::Channel::State
        || frame.packet_id != static_cast<std::uint8_t>(protocol::StatePacketId::WorldDelta))
        return;
    const auto *delta = flatbuffers::GetRoot<protocol::WorldDelta>(frame.payload.data());
    if (!delta->full_state() || !delta->upserts() || delta->local_entity_id() == 0)
        return;
    if (synced_ && frame.session_generation != generation_
        && static_cast<std::int8_t>(frame.session_generation - generation_) <= 0)
        return;
    if (synced_ && frame.session_generation == generation_
        && static_cast<std::int32_t>(delta->snapshot_id() - snapshot_id_) <= 0)
        return;
    bool has_local = false;
    for (const auto *state : *delta->upserts())
        has_local |= state->id() == delta->local_entity_id() && state->kind() == protocol::EntityKind::Tank;
    if (!has_local) return;

    auto *registry = simulation_.get_registry();
    if (!synced_ || frame.session_generation != generation_) {
        registry->clear();
        entities_.clear();
        input_id_ = 0;
    }
    generation_ = frame.session_generation;
    snapshot_id_ = delta->snapshot_id();
    synced_ = true;
    std::unordered_set<std::uint32_t> present;
    for (const auto *state : *delta->upserts()) {
        present.insert(state->id());
        auto [it, inserted] = entities_.try_emplace(state->id(), entt::null);
        if (inserted) {
            it->second = registry->create();
            registry->emplace<simulation::Transform>(it->second);
            registry->emplace<simulation::Color>(it->second, simulation::Color { 38, 217, 191, 255 });
            if (state->kind() == protocol::EntityKind::Tank) {
                registry->emplace<simulation::Tank>(it->second, simulation::Tank {
                    .name = state->id() == delta->local_entity_id() ? "You" : "Player",
                    .size = 20, .dir = { -1, 0 }, .type = simulation::TankType::TANK_BASIC });
                registry->emplace<simulation::Health>(it->second, simulation::Health { 100, 100 });
            } else if (state->kind() == protocol::EntityKind::Resource) {
                const bool square = state->resource_shape() == protocol::ResourceShape::Square;
                registry->emplace<simulation::ShapeType>(it->second, square ? simulation::ShapeType::SHAPE_RECT : simulation::ShapeType::SHAPE_CIRCLE);
                registry->emplace<simulation::Shape>(it->second, square
                    ? simulation::Shape { .rect = { .width = 40.F, .height = 40.F } }
                    : simulation::Shape { .circle = { .size = 40.F } });
                registry->emplace<simulation::Ressource>(it->second, simulation::Ressource { .health = 100, .max_health = 100 });
            } else if (state->kind() == protocol::EntityKind::Projectile) {
                registry->emplace<simulation::Projectile>(it->second, simulation::Projectile { .damage = 0, .lifetime = 0, .creation_time = 0, .type = simulation::ProjectileType::PROJECTILE_BASIC });
            }
        }
        auto &transform = registry->get<simulation::Transform>(it->second);
        transform.pos = { state->position()->x() / 5.F, state->position()->y() / 5.F };
        transform.vel = { state->velocity()->x() / 5.F, state->velocity()->y() / 5.F };
        const float angle = state->aim_angle() * (2.F * std::numbers::pi_v<float> / 65536.F);
        if (state->kind() == protocol::EntityKind::Tank) {
            registry->get<simulation::Tank>(it->second).dir = { -std::cos(angle), -std::sin(angle) };
            registry->get<simulation::Health>(it->second).value = state->health();
        } else if (state->kind() == protocol::EntityKind::Resource) {
            transform.pos -= glm::vec2(20.F);
            transform.rotation = state->rotation() * (2.F * std::numbers::pi_v<float> / 65536.F);
            registry->get<simulation::Ressource>(it->second).health = state->health();
        } else {
            transform.rotation = angle - std::numbers::pi_v<float>;
        }
        if (state->id() == delta->local_entity_id()) simulation_.set_player(it->second);
    }
    for (auto it = entities_.begin(); it != entities_.end();) {
        if (!present.contains(it->first)) { registry->destroy(it->second); it = entities_.erase(it); }
        else ++it;
    }
}

void App::send_input()
{
    if (!synced_) return;
    const auto &state = platform_.get_input();
    const int x = static_cast<int>(state.keys[platform::Keys::KEY_D]) - static_cast<int>(state.keys[platform::Keys::KEY_A]);
    const int y = static_cast<int>(state.keys[platform::Keys::KEY_S]) - static_cast<int>(state.keys[platform::Keys::KEY_W]);
    const float dx = state.mouse_pos.x - platform::Platform::width() / 2.F;
    const float dy = state.mouse_pos.y - platform::Platform::height() / 2.F;
    float angle = std::atan2(dy, dx);
    if (angle < 0) angle += 2.F * std::numbers::pi_v<float>;
    const auto aim = static_cast<std::uint16_t>(angle * (65536.F / (2.F * std::numbers::pi_v<float>)));
    const auto buttons = (state.keys[platform::Keys::MOUSE_BUTTON_LEFT] ? 1 : 0)
        | (state.keys[platform::Keys::KEY_LEFT_SHIFT] ? 2 : 0);
    const std::vector<protocol::InputFrame> frames { protocol::InputFrame(static_cast<std::int8_t>(x * 127), static_cast<std::int8_t>(y * 127), aim, static_cast<protocol::InputButtons>(buttons)) };
    flatbuffers::FlatBufferBuilder builder;
    const auto payload = protocol::CreatePlayerInputDirect(builder, snapshot_id_, ++input_id_, &frames);
    builder.Finish(payload);
    std::vector<std::uint8_t> packet { static_cast<std::uint8_t>(protocol::StatePacketId::PlayerInput), generation_ };
    packet.insert(packet.end(), builder.GetBufferPointer(), builder.GetBufferPointer() + builder.GetSize());
    network_.append(protocol::Channel::State, packet);
}
#endif

bool App::initialize()
{
    if (!platform_.initialize()) {
        return false;
    }
    renderer_.init();
    this->tank_name_ = "test";
    simulation::Tank tank {
        .name = tank_name_,
        .size = 20,
        .dir = glm::vec2(0),
        .type = simulation::TankType::TANK_BASIC,
    };
    simulation_.create_player_tank(tank,
        simulation::Transform {
            .pos = { 100.F, 100.F },
            .vel = glm::vec2(0),
            .acc = glm::vec2(0),
            .rotation = 0,
        },
        simulation::Color { .r = 38, .g = 217, .b = 191, .a = 255 });

    return true;
}

bool App::should_quit()
{
    if (!platform::Platform::should_quit()) {
        return false;
    }

    spdlog::info("Quitting demo");
    return true;
}

void App::update_player()
{
    auto *player_transform = this->simulation_.get_player_transform();
    auto &player_acc = player_transform->acc;
    glm::vec2 dir(0);
    float speed = 5000.F;
    auto &state = platform_.get_input();

    if (state.keys[platform::Keys::KEY_W])
        dir.y -= 1;
    if (state.keys[platform::Keys::KEY_S])
        dir.y += 1;
    if (state.keys[platform::Keys::KEY_A])
        dir.x -= 1;
    if (state.keys[platform::Keys::KEY_D])
        dir.x += 1;

    SPDLOG_DEBUG(
        "input state, a {}, w {}, d {}, s {} mouse pos {}, left {}, right { } ",
        state.keys[platform::Keys::KEY_A], state.keys[platform::Keys::KEY_W],
        state.keys[platform::Keys::KEY_D], state.keys[platform::Keys::KEY_S],
        state.mouse_pos, state.keys[platform::Keys::MOUSE_BUTTON_LEFT],
        state.keys[platform::Keys::MOUSE_BUTTON_RIGHT]);

    static double last_dash = platform::Platform::get_time();
    const double dash_rate = 0.5F;

    if (glm::length(dir) > 0) {
        player_acc = glm::normalize(dir) * speed;
        if (state.keys_first[platform::Keys::KEY_LEFT_SHIFT]
            && platform::Platform::get_time() - last_dash > 1.F / dash_rate) {
            last_dash = platform::Platform::get_time();
            player_acc += glm::normalize(dir) * (speed * 20);
        }
    } else {
        player_acc = glm::vec2(0);
    }

    auto &player_dir = simulation_.get_player_tank()->dir;
    player_dir
        = glm::normalize((glm::vec2 { game::platform::Platform::width() / 2.F,
                              game::platform::Platform::height() / 2.F }
            - glm::vec2 { state.mouse_pos.x, state.mouse_pos.y }));

    static double last_fire = platform::Platform::get_time();
    const double fire_rate = 3.F; // per second

    if (state.keys[platform::Keys::MOUSE_BUTTON_LEFT]
        && platform::Platform::get_time() - last_fire > 1.F / fire_rate) {
        last_fire = platform::Platform::get_time();
        simulation_.fire_player_tank();
    }
}

void App::iterate()
{
#ifdef __EMSCRIPTEN__
    network_.set_status(network::status());
    if (!network_.receive(
            [](std::span<std::uint8_t> bytes) {
                return network::drain(
                    bytes.data(), static_cast<int>(bytes.size()));
            },
            [this](const protocol::Frame &frame) { receive_frame(frame); })) {
        network::failure();
        network_.set_status(-1);
    }
#endif

    if (GetScreenHeight() == 0 || GetScreenWidth() == 0)
        return;

    const double delta_seconds = platform::Platform::delta_seconds();
    platform_.update_inputs();
#ifdef __EMSCRIPTEN__
    input_elapsed_ += delta_seconds;
    if (input_elapsed_ >= 1.0 / 60.0) {
        input_elapsed_ = 0;
        send_input();
    }
#else
    update_player();
    simulation_.update(delta_seconds);
#endif

#ifdef __EMSCRIPTEN__
    if (!network_.submit([](std::span<const std::uint8_t> bytes) {
            return network::submit(bytes.data(), static_cast<int>(bytes.size()))
                != 0;
        }))
        network_.set_status(-1);
#endif

#ifdef __EMSCRIPTEN__
    if (!synced_) return;
#endif
    renderer_.draw(simulation_);
}

} // namespace game::core
