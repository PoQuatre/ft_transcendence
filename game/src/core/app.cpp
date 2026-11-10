/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.cpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:46 by mle-flem          #+#    #+#             */
/*   Updated: 2026/11/09 20:11:41 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/app.hpp"

#include <spdlog/spdlog.h>

#include <cmath>
#include <numbers>
#include <unordered_set>

#include "game/colors.hpp"
#include "game/renderer.hpp"
#include "glm/geometric.hpp"

namespace game::core {

#ifdef __EMSCRIPTEN__

void App::sync_world(
    const protocol::WorldDelta *delta, entt::registry *registry)
{
    std::unordered_set<entt::entity> present;

    for (const auto *state : *delta->upserts()) {
        auto entity = registry->create(static_cast<entt::entity>(state->id()));
        present.insert(entity);

        auto &transform = registry->get_or_emplace<simulation::Transform>(
            entity, simulation::Transform { });

        auto &color = registry->get_or_emplace<simulation::Color>(
            entity, simulation::Color { });
        color = renderer::Colors::colors[renderer::Colors::COLOR_AMBER];

        transform.pos
            = { state->position()->x() / 5.F, state->position()->y() / 5.F };
        transform.vel
            = { state->velocity()->x() / 5.F, state->velocity()->y() / 5.F };

        const float angle
            = state->aim_angle() * (2.F * std::numbers::pi_v<float> / 65536.F);
        transform.rotation = angle - std::numbers::pi_v<float>;

        if (state->kind() == protocol::EntityKind::Tank) {
            const auto *name
                = state->id() == delta->local_entity_id() ? "You" : "Player";
            registry
                ->get_or_emplace<simulation::Tank>(entity,
                    simulation::Tank {
                        .name = name,
                        .size = 20,
                        .dir = { -1, 0 },
                        .type = simulation::TankType::TANK_BASIC,
                    })
                .dir = { -std::cos(angle), -std::sin(angle) };
            registry
                ->get_or_emplace<simulation::Health>(entity,
                    simulation::Health {
                        .value = static_cast<float>(state->health()),
                        .maximum = 100,
                    })
                .value = state->health();
            registry->emplace_or_replace<simulation::PointLight>(entity,
                simulation::PointLight {
                    .radius = 300.F,
                    .color
                    = renderer::Colors::colors[renderer::Colors::COLOR_CYAN],
                    .intensity = 1.F,
                    .cast_shadows = true,
                });
        } else if (state->kind() == protocol::EntityKind::Resource) {
            transform.pos -= glm::vec2(20.F);
            transform.rotation = state->rotation()
                * (2.F * std::numbers::pi_v<float> / 65536.F);
            const bool square
                = state->resource_shape() == protocol::ResourceShape::Square;
            registry->emplace_or_replace<simulation::ShapeType>(entity,
                static_cast<simulation::ShapeType>(state->resource_shape()));
            const auto shape = square
                ? simulation::Shape { .rect
                      = { .width = 40.F, .height = 40.F }, }
                : simulation::Shape { .circle = { .size = 40.F } };
            registry->emplace_or_replace<simulation::Shape>(entity, shape);

            auto &ressource
                = registry->get_or_emplace<simulation::Ressource>(entity,
                    simulation::Ressource { .health = 100, .max_health = 100 });
            ressource.health = state->health();
        } else if (state->kind() == protocol::EntityKind::Projectile) {
            registry->emplace_or_replace<simulation::Projectile>(entity,
                simulation::Projectile {
                    .damage = 0,
                    .lifetime = 0,
                    .creation_time = 0,
                    .type = simulation::ProjectileType::PROJECTILE_BASIC,
                });
            registry->emplace_or_replace<simulation::PointLight>(entity,
                simulation::PointLight {
                    .radius = 100.F,
                    .color
                    = renderer::Colors::colors[renderer::Colors::COLOR_GREEN],
                    .intensity = 1.F,
                    .cast_shadows = true,
                });
        }

        if (state->id() == delta->local_entity_id())
            simulation_.set_player(entity);
    }

    for (auto it : registry->view<simulation::Transform, simulation::Color>()) {
        if (!present.contains(it)) {
            registry->destroy(it);
        }
    }
}

void App::receive_frame(const protocol::Frame &frame)
{
    if (frame.channel != protocol::Channel::State
        || frame.packet_id
            != static_cast<std::uint8_t>(protocol::StatePacketId::WorldDelta))
        return;

    const auto *delta
        = flatbuffers::GetRoot<protocol::WorldDelta>(frame.payload.data());
    if (!delta->full_state() || !delta->upserts()
        || delta->local_entity_id() == 0)
        return;
    if (synced_ && frame.session_generation != generation_
        && static_cast<std::int8_t>(frame.session_generation - generation_)
            <= 0)
        return;
    if (synced_ && frame.session_generation == generation_
        && static_cast<std::int32_t>(delta->snapshot_id() - snapshot_id_) <= 0)
        return;

    // Why check this ? every snapshot should have the player tank. Even without
    // it, we need to update
    bool has_local = false;
    for (const auto *state : *delta->upserts())
        has_local |= state->id() == delta->local_entity_id()
            && state->kind() == protocol::EntityKind::Tank;
    if (!has_local)
        return;

    auto *registry = simulation_.get_registry();
    if (!synced_ || frame.session_generation != generation_) {
        registry->clear();
        entities_.clear();
        input_id_ = 0;
    }
    generation_ = frame.session_generation;
    snapshot_id_ = delta->snapshot_id();
    synced_ = true;
    sync_world(delta, registry);
}

void App::send_input()
{
    if (!synced_)
        return;

    const auto &state = platform_.get_input();
    const int x = static_cast<int>(state.keys[platform::Keys::KEY_D])
        - static_cast<int>(state.keys[platform::Keys::KEY_A]);
    const int y = static_cast<int>(state.keys[platform::Keys::KEY_S])
        - static_cast<int>(state.keys[platform::Keys::KEY_W]);

    const float dx = state.mouse_pos.x - (platform::Platform::width() / 2.F);
    const float dy = state.mouse_pos.y - (platform::Platform::height() / 2.F);
    float angle = std::atan2(dy, dx);
    if (angle < 0)
        angle += 2.F * std::numbers::pi_v<float>;
    const auto aim = static_cast<std::uint16_t>(
        angle * (65536.F / (2.F * std::numbers::pi_v<float>)));

    const auto buttons = (state.keys[platform::Keys::MOUSE_BUTTON_LEFT] ? 1 : 0)
        | (state.keys[platform::Keys::KEY_LEFT_SHIFT] ? 2 : 0);
    const std::vector<protocol::InputFrame> frames {
        protocol::InputFrame(static_cast<std::int8_t>(x * 127),
            static_cast<std::int8_t>(y * 127), aim,
            static_cast<protocol::InputButtons>(buttons)),
    };

    flatbuffers::FlatBufferBuilder builder;
    const auto payload = protocol::CreatePlayerInputDirect(
        builder, snapshot_id_, ++input_id_, &frames);
    builder.Finish(payload);

    std::vector<std::uint8_t> packet {
        static_cast<std::uint8_t>(protocol::StatePacketId::PlayerInput),
        generation_,
    };
    packet.insert(packet.end(), builder.GetBufferPointer(),
        builder.GetBufferPointer() + builder.GetSize());
    network_.append(protocol::Channel::State, packet);
}
#endif

bool App::initialize()
{
    if (!platform_.initialize()) {
        return false;
    }
    renderer_.init();

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
    // simulation_.update(delta_seconds);
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
    if (!synced_)
        return;
#endif
    renderer_.draw(simulation_);
}

} // namespace game::core
