/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.cpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:46 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/01 12:38:45 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/app.hpp"

#include <spdlog/spdlog.h>

#include "game/renderer.hpp"
#include "glm/geometric.hpp"

namespace game::core {

bool App::initialize()
{
    if (!platform_.initialize()) {
        return false;
    }
    tank_name_ = "test";
    simulation::Tank tank { .name = tank_name_, .size = 20 };
    simulation_.create_player_tank(tank, simulation::Position { 100.F, 100.F },
        simulation::Color { .r = 38, .g = 217, .b = 191, .a = 255 });

    simulation_.create_ressource({ 50, 50 }, { 100 },
        { .rect = { .width = 30, .height = 30 } }, simulation::SHAPE_RECT,
        { .r = 255, .g = 0, .b = 0, .a = 255 });
    simulation_.create_ressource({ 150, 50 }, { 100 }, { .circle = { 30.F } },
        simulation::SHAPE_CIRCLE, { .r = 255, .g = 0, .b = 0, .a = 255 });
    simulation_.create_ressource({ 50, 150 }, { 100 }, { .circle = { 30.F } },
        simulation::SHAPE_CIRCLE, { .r = 255, .g = 0, .b = 0, .a = 255 });

    simulation_.create_obstacle({ 0, 0 },
        { .rect = { .width = 20,
              .height
              = static_cast<float>(game::platform::Platform::height()) } },
        simulation::SHAPE_RECT, { .r = 255, .g = 0, .b = 0, .a = 255 });
    simulation_.create_obstacle({ 0, 0 },
        { .rect
            = { .width = static_cast<float>(game::platform::Platform::width()),
                .height = 20 } },
        simulation::SHAPE_RECT, { .r = 255, .g = 0, .b = 0, .a = 255 });
    simulation_.create_obstacle(
        { static_cast<float>(game::platform::Platform::width()) - 40, 0 },
        { .rect = { .width = 20,
              .height
              = static_cast<float>(game::platform::Platform::height()) } },
        simulation::SHAPE_RECT, { .r = 255, .g = 0, .b = 0, .a = 255 });
    simulation_.create_obstacle(
        { 0, static_cast<float>(game::platform::Platform::height()) - 40 },
        { .rect
            = { .width = static_cast<float>(game::platform::Platform::width()),
                .height = 20 } },
        simulation::SHAPE_RECT, { .r = 255, .g = 0, .b = 0, .a = 255 });

    spdlog::info("Created an EnTT ball. Press Escape to quit.");
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
    auto *player_acc = simulation_.get_player_acceleration();
    glm::vec2 dir;
    float speed = 5000.F;
    auto &state = platform_.get_input();

    if (state.keys[platform::keys::KEY_W]) {
        dir.y -= 1;
    }
    if (state.keys[platform::keys::KEY_S]) {
        dir.y += 1;
    }
    if (state.keys[platform::keys::KEY_A]) {
        dir.x -= 1;
    }
    if (state.keys[platform::keys::KEY_D]) {
        dir.x += 1;
    }
    if (glm::length(dir) > 0) {
        *player_acc = glm::normalize(dir) * speed;
    } else {
        *player_acc = glm::vec2(0);
    }

    auto *player_dir = simulation_.get_player_direction();
    auto *player_pos = simulation_.get_player_position();
    *player_dir = glm::normalize(*player_pos - state.mouse_pos);

    static double last_fire = 0;
    const double fire_rate = 3.F; // per second

    if (state.keys[platform::keys::MOUSE_BUTTON_LEFT]
        && platform::Platform::get_time() - last_fire > 1.F / fire_rate) {
        last_fire = platform::Platform::get_time();
        SPDLOG_INFO("FIRE FIRE");
        simulation_.fire_player_tank();
    }
}

void App::iterate()
{
    const double delta_seconds = platform::Platform::delta_seconds();
    platform_.update_inputs();
    update_player();
    // auto &state = platform_.get_input();
    // SPDLOG_INFO("input state, a {}, w {}, d {}, s {} mouse pos {}",
    //     state.keys[platform::keys::KEY_A], state.keys[platform::keys::KEY_W],
    //     state.keys[platform::keys::KEY_D], state.keys[platform::keys::KEY_S],
    //     state.mouse_pos);

    simulation_.update(delta_seconds, platform::Platform::width(),
        platform::Platform::height());
    renderer::Renderer::draw(simulation_.get_registry());
}

} // namespace game::core
