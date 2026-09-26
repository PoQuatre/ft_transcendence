/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.cpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:30 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/20 04:30:49 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/renderer.hpp"

#include <raylib.h>

namespace game::renderer {

void Renderer::draw(const simulation::Ball &ball)
{
    BeginDrawing();
    ClearBackground(Color { .r = 8, .g = 13, .b = 26, .a = 255 });
    DrawCircleV(
        Vector2 {
            .x = ball.x + (ball.size / 2.0F),
            .y = ball.y + (ball.size / 2.0F),
        },
        ball.size / 2.0F, Color { .r = 38, .g = 217, .b = 191, .a = 255 });
    DrawFPS(8, 8);
    EndDrawing();
}

} // namespace game::renderer
