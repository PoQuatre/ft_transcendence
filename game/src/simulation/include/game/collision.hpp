/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   collision.hpp                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/01 08:33:24 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/01 11:44:53 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include "game/simulation.hpp"

namespace game::simulation::collision {

CollisionHit circle_to_rect(
    Position a_pos, Shape::circle_t a, Position b_pos, Shape::rect_t b);
CollisionHit rect_to_rect(
    Position a_pos, Shape::rect_t a, Position b_pos, Shape::rect_t b);
CollisionHit circle_to_circle(
    Position a_pos, Shape::circle_t a, Position b_pos, Shape::circle_t b);

}
