/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/20 04:30:59 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include "game/simulation.hpp"

namespace game::renderer {

class Renderer {
public:
    static void draw(const simulation::Ball &ball);
};

} // namespace game::renderer
