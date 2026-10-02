/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/02 10:00:57 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include "game/simulation.hpp"

namespace game::renderer {

class Renderer {
public:
    static void draw(const entt::registry *registry);

private:
    static void draw_progress_bar(glm::vec2 pos, glm::vec2 size,
        simulation::Color background, simulation::Color foreground, float value,
        float max_value);
};

} // namespace game::renderer
