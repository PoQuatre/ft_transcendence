/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.cpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:30 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/08 08:02:35 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/renderer.hpp"

#include <raylib.h>

#include "game/simulation.hpp"

namespace game::renderer {

void Renderer::draw(simulation::Simulation &sim)
{
    auto *registry = sim.get_registry();
    const float camera_zoom = 1.F;
    const auto tank = registry->view<simulation::Tank>().begin();
    const auto &player_pos = registry->get<simulation::Position>(*tank);
    const auto &player_tank = registry->get<simulation::Tank>(*tank);

    Camera2D camera { };
    camera.target = { .x = player_pos.x + (player_tank.size / 2),
        .y = player_pos.y + (player_tank.size / 2) };
    camera.offset
        = { .x = GetRenderWidth() / 2.F, .y = GetRenderHeight() / 2.F };
    camera.rotation = 0;
    camera.zoom = camera_zoom;

    BeginDrawing();
    ClearBackground(Color { .r = 8, .g = 13, .b = 255, .a = 255 });
    BeginMode2D(camera);

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
             simulation::Position, simulation::ShapeType>()) {
        const auto &position = registry->get<simulation::Position>(entity);
        const auto &color = registry->get<simulation::Color>(entity);

        const auto &shape_type = registry->get<simulation::ShapeType>(entity);
        const auto &shape = registry->get<simulation::Shape>(entity);

        const auto *res = registry->try_get<simulation::Ressource>(entity);

        switch (shape_type) {
        case simulation::ShapeType::SHAPE_RECT:
            DrawRectangle(position.x, position.y, shape.rect.width,
                shape.rect.height,
                Color {
                    .r = color.r, .g = color.g, .b = color.b, .a = color.a });
            if (res != nullptr) {
                if (res->health != res->max_health) {
                    Renderer::draw_progress_bar(
                        { position.x, position.y + shape.rect.height + 4 },
                        { 20, 10 }, { .r = 255, .g = 255, .b = 255, .a = 255 },
                        { .r = 0, .g = 0, .b = 0, .a = 255 }, res->health,
                        res->max_health);
                }
            }
            break;
        case simulation::ShapeType::SHAPE_CIRCLE:
            DrawCircleV(
                Vector2 {
                    .x = position.x + (shape.circle.size / 2.0F),
                    .y = position.y + (shape.circle.size / 2.0F),
                },
                shape.circle.size / 2.0F,
                Color {
                    .r = color.r, .g = color.g, .b = color.b, .a = color.a });
            if (res != nullptr) {
                if (res->health != res->max_health) {
                    Renderer::draw_progress_bar(
                        { position.x, position.y + shape.circle.size + 4 },
                        { 20, 10 }, { .r = 255, .g = 255, .b = 255, .a = 255 },
                        { .r = 0, .g = 0, .b = 0, .a = 255 }, res->health,
                        res->max_health);
                }
            }
            break;
        }
    }

    // DrawLine((int)camera.target.x, -GetRenderHeight() * 10,
    //     (int)camera.target.x, GetRenderHeight() * 10, GREEN);
    // DrawLine(-GetRenderWidth() * 10, (int)camera.target.y,
    //     GetRenderWidth() * 10, (int)camera.target.y, GREEN);
    // const auto &quad = sim.get_quad_tree();
    // quad.render();

    EndMode2D();

    DrawFPS(8, 8);
    EndDrawing();
}

void Renderer::draw_progress_bar(glm::vec2 pos, glm::vec2 size,
    simulation::Color background, simulation::Color foreground, float value,
    float max_value)
{
    DrawRectangle(pos.x, pos.y, size.x, size.y,
        Color {
            .r = background.r,
            .g = background.g,
            .b = background.b,
            .a = background.a,
        });
    DrawRectangle(pos.x + 2, pos.y + 1, (value / max_value) * (size.x - 2),
        size.y - 2,
        Color {
            .r = foreground.r,
            .g = foreground.g,
            .b = foreground.b,
            .a = foreground.a,
        });
}

} // namespace game::renderer
