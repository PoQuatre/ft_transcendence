/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.cpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:46 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/09 06:44:48 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/app.hpp"

#include <spdlog/spdlog.h>

#include "game/renderer.hpp"
#include "glm/geometric.hpp"

namespace {
void break_point() { SPDLOG_INFO("BREAK"); }

}

namespace game::core {

bool App::initialize()
{
    if (!platform_.initialize()) {
        return false;
    }
    this->tank_name_ = "test";
    simulation::Tank tank {
        .name = tank_name_,
        .size = 20,
        .dir = glm::vec2(0),
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

    if (state.keys[platform::Keys::KEY_W]) {
        break_point();
        dir.y -= 1;
    }
    if (state.keys[platform::Keys::KEY_S]) {
        dir.y += 1;
    }
    if (state.keys[platform::Keys::KEY_A]) {
        dir.x -= 1;
    }
    if (state.keys[platform::Keys::KEY_D]) {
        dir.x += 1;
    }

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
    const double delta_seconds = platform::Platform::delta_seconds();
    platform_.update_inputs();
    update_player();

    simulation_.update(delta_seconds);
    renderer::Renderer::draw(simulation_);
}

} // namespace game::core
