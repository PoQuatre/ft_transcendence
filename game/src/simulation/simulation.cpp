/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.cpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:41 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/10 21:49:44 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/simulation.hpp"

#include <algorithm>

namespace game::simulation {

namespace {

constexpr float ball_size = 40.0F;

} // namespace

Simulation::Simulation()
    : ball_(registry_.create())
{
    registry_.emplace<Position>(ball_, 100.0F, 100.0F);
    registry_.emplace<Velocity>(ball_, 240.0F, 180.0F);
}

void Simulation::update(float delta_seconds, int width, int height)
{
    const float max_x = std::max(0.0F, static_cast<float>(width) - ball_size);
    const float max_y = std::max(0.0F, static_cast<float>(height) - ball_size);

    for (const auto entity : registry_.view<Position, Velocity>()) {
        auto &position = registry_.get<Position>(entity);
        auto &velocity = registry_.get<Velocity>(entity);
        position.x += velocity.x * delta_seconds;
        position.y += velocity.y * delta_seconds;

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

Ball Simulation::ball() const
{
    const auto &position = registry_.get<Position>(ball_);
    return {
        .x = position.x,
        .y = position.y,
        .size = ball_size,
    };
}

} // namespace game::simulation
