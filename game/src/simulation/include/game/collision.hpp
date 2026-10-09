/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   collision.hpp                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/01 08:33:24 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/09 04:46:00 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include "game/simulation.hpp"

namespace game::simulation::collision {

CollisionHit circle_to_rect(Transform transform_a, Shape::circle_t a,
    Transform transform_b, Shape::rect_t b);
CollisionHit rect_to_rect(Transform transform_a, Shape::rect_t a,
    Transform transform_b, Shape::rect_t b);
CollisionHit circle_to_circle(Transform transform_a, Shape::circle_t a,
    Transform transform_b, Shape::circle_t b);

}
