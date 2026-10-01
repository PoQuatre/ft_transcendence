/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.cpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:30 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/01 07:47:15 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/renderer.hpp"

#include <raylib.h>

#include "game/simulation.hpp"

namespace game::renderer {

void Renderer::draw(const entt::registry *registry)
{
    BeginDrawing();
    ClearBackground(Color { .r = 8, .g = 13, .b = 255, .a = 255 });
    for (const auto entity : registry->view<simulation::Tank, simulation::Color,
             simulation::Position, simulation::Direction>()) {

        const auto &direction = registry->get<simulation::Direction>(entity);
        const auto &position = registry->get<simulation::Position>(entity);
        const auto &tank = registry->get<simulation::Tank>(entity);
        const auto &color = registry->get<simulation::Color>(entity);

        DrawCircleV(
            Vector2 {
                .x = position.x + (tank.size / 2.0F),
                .y = position.y + (tank.size / 2.0F),
            },
            tank.size / 2.0F,
            Color { .r = color.r, .g = color.g, .b = color.b, .a = color.a });

        float rot = (atan2(direction.y, direction.x) - (M_PI_2)) * RAD2DEG;
        DrawRectanglePro({ .x = position.x + (tank.size / 2.0F),
                             .y = position.y + (tank.size / 2.0F),
                             .width = 10,
                             .height = 30 },
            { .x = 5, .y = 30 }, rot,
            Color { .r = color.r, .g = color.g, .b = color.b, .a = color.a });
        DrawText(tank.name.c_str(),
            position.x - ((tank.name.size() / 2.F) + 12),
            position.y - ((tank.size / 2) + 12), 24,
            Color { .r = 0xFF, .g = 0xFF, .b = 0xFF, .a = 0xFF });
    }
    for (const auto entity : registry->view<simulation::Color,
             simulation::Position, simulation::Projectile>()) {
        const auto &position = registry->get<simulation::Position>(entity);
        const auto &color = registry->get<simulation::Color>(entity);
        const auto &projectile = registry->get<simulation::Projectile>(entity);

        DrawCircleV(
            Vector2 {
                .x = position.x + (projectile.size / 2.0F),
                .y = position.y + (projectile.size / 2.0F),
            },
            projectile.size / 2.0F,
            Color { .r = color.r, .g = color.g, .b = color.b, .a = color.a });
    }
    DrawFPS(8, 8);
    EndDrawing();
}

} // namespace game::renderer
