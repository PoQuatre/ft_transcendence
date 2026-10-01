/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.cpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:41 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/01 08:07:14 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/simulation.hpp"

#include <spdlog/spdlog.h>

#include <algorithm>

namespace game::simulation {

namespace {

constexpr float ball_size = 40.0F;

} // namespace

Simulation::Simulation()
{
    ball_ = registry_.create();
    registry_.emplace<Position>(ball_, glm::vec2 { 100.0F, 100.0F });
    registry_.emplace<Velocity>(ball_, glm::vec2 { 240.0F, 180.0F });
}

void Simulation::update(float delta_seconds, int width, int height)
{
    const float max_x = std::max(0.0F, static_cast<float>(width) - ball_size);
    const float max_y = std::max(0.0F, static_cast<float>(height) - ball_size);

    for (const auto entity : registry_.view<Position, Velocity>()) {
        auto &position = registry_.get<Position>(entity);
        auto &velocity = registry_.get<Velocity>(entity);
        position += velocity * delta_seconds;
    }

    for (const auto entity : registry_.view<Position, Velocity, Projectile>()) {
        auto &position = registry_.get<Position>(entity);
        auto &velocity = registry_.get<Velocity>(entity);

        if (position.x < 0.0F || position.x > max_x) {
            position.x = std::clamp(position.x, 0.0F, max_x);
            velocity.x = -velocity.x;
        }
        if (position.y < 0.0F || position.y > max_y) {
            position.y = std::clamp(position.y, 0.0F, max_y);
            velocity.y = -velocity.y;
        }
    }
}
void Simulation::create_player_tank(Tank &tank, Position pos, Color col)
{
    player_tank = registry_.create();
    registry_.emplace<Position>(player_tank, pos);
    registry_.emplace<Velocity>(player_tank, Velocity { 0.F, 0.F });
    registry_.emplace<Direction>(player_tank, Direction { 0.F, 0.F });
    registry_.emplace<Color>(player_tank, col);
    registry_.emplace<Tank>(player_tank, tank);
}

Velocity *Simulation::get_player_velocity()
{
    return &registry_.get<Velocity>(player_tank);
}

Direction *Simulation::get_player_direction()
{
    return &registry_.get<Direction>(player_tank);
}

Position *Simulation::get_player_position()
{
    return &registry_.get<Position>(player_tank);
}

void Simulation::fire_player_tank()
{
    const entt::entity bullet = registry_.create();
    auto &player_pos = registry_.get<Position>(player_tank);
    auto &player_dir = registry_.get<Direction>(player_tank);
    auto &player_col = registry_.get<Color>(player_tank);
    // auto &tank = registry_.get<Tank>(player_tank);
    const float bullet_speed = 1000.F;
    glm::vec2 bullet_vel = -player_dir * bullet_speed;

    registry_.emplace<Position>(bullet, player_pos);
    registry_.emplace<Velocity>(bullet, bullet_vel);
    registry_.emplace<Color>(bullet, player_col);
    registry_.emplace<Projectile>(bullet, 10.F);
}

Ball Simulation::ball() const
{
    const auto &position = registry_.get<Position>(ball_);
    return {
        .pos = Position { position.x, position.y },
        .size = ball_size,
    };
}

} // namespace game::simulation
