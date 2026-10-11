/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/11 19:09:17 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <raylib.h>

#include "game/simulation.hpp"

namespace game::renderer {

class Renderer {
public:
    Renderer() = default;
    void init();
    void draw(simulation::Simulation &simulation);

private:
    static void draw_progress_bar(glm::vec2 pos, glm::vec2 size,
        simulation::Color background, simulation::Color foreground, float value,
        float max_value);

    std::array<Texture, simulation::TankType::TANK_TYPE_MAX> tank_textures;
};

} // namespace game::renderer
