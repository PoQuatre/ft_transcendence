/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   collision.cpp                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/01 10:17:29 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/09 04:48:06 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/collision.hpp"

#include <glm/geometric.hpp>

namespace game::simulation::collision {

CollisionHit circle_to_rect(Transform transform_a, Shape::circle_t a,
    Transform transform_b, Shape::rect_t b)
{
    const float radius = a.size / 2.0F;

    const glm::vec2 circle_center {
        transform_a.pos.x + radius,
        transform_a.pos.y + radius,
    };
    const glm::vec2 rect_min {
        transform_b.pos.x,
        transform_b.pos.y,
    };
    const glm::vec2 rect_max {
        transform_b.pos.x + b.width,
        transform_b.pos.y + b.height,
    };

    const glm::vec2 closest {
        std::clamp(circle_center.x, rect_min.x, rect_max.x),
        std::clamp(circle_center.y, rect_min.y, rect_max.y),
    };

    const glm::vec2 difference = closest - circle_center;
    const float distance_squared = glm::dot(difference, difference);

    if (distance_squared >= radius * radius) {
        return CollisionHit {
            .penetration = 0.0F,
            .normal = glm::vec2 { 0.0F, 0.0F },
        };
    }

    // Circle center is outside the rectangle.
    if (distance_squared > 0.000001F) {
        const float distance = std::sqrt(distance_squared);

        return CollisionHit {
            .penetration = radius - distance,
            .normal = difference / distance,
        };
    }

    // Circle center is inside the rectangle.
    //
    // Find the closest edge and push the circle
    // toward that edge.
    const float left = circle_center.x - rect_min.x;
    const float right = rect_max.x - circle_center.x;
    const float top = circle_center.y - rect_min.y;
    const float bottom = rect_max.y - circle_center.y;

    const float min_distance = std::min({ left, right, top, bottom });

    if (min_distance == left) {
        return CollisionHit {
            .penetration = radius + left,
            .normal = glm::vec2 { -1.0F, 0.0F },
        };
    }

    if (min_distance == right) {
        return CollisionHit {
            .penetration = radius + right,
            .normal = glm::vec2 { 1.0F, 0.0F },
        };
    }

    if (min_distance == top) {
        return CollisionHit {
            .penetration = radius + top,
            .normal = glm::vec2 { 0.0F, -1.0F },
        };
    }

    return CollisionHit {
        .penetration = radius + bottom,
        .normal = glm::vec2 { 0.0F, 1.0F },
    };
}

CollisionHit rect_to_rect(Transform transform_a, Shape::rect_t a,
    Transform transform_b, Shape::rect_t b)
{
    const float a_left = transform_a.pos.x;
    const float a_right = transform_a.pos.x + a.width;
    const float a_top = transform_a.pos.y;
    const float a_bottom = transform_a.pos.y + a.height;

    const float b_left = transform_b.pos.x;
    const float b_right = transform_b.pos.x + b.width;
    const float b_top = transform_b.pos.y;
    const float b_bottom = transform_b.pos.y + b.height;

    const float overlap_x
        = std::min(a_right, b_right) - std::max(a_left, b_left);

    const float overlap_y
        = std::min(a_bottom, b_bottom) - std::max(a_top, b_top);

    if (overlap_x <= 0.0F || overlap_y <= 0.0F) {
        return CollisionHit {
            .penetration = 0.0F,
            .normal = glm::vec2 { 0.0F, 0.0F },
        };
    }

    const glm::vec2 a_center {
        transform_a.pos.x + (a.width / 2.0F),
        transform_a.pos.y + (a.height / 2.0F),
    };

    const glm::vec2 b_center {
        transform_b.pos.x + (b.width / 2.0F),
        transform_b.pos.y + (b.height / 2.0F),
    };

    const glm::vec2 center_difference = b_center - a_center;

    if (overlap_x < overlap_y) {
        return CollisionHit{
            .penetration = overlap_x,
            .normal = glm::vec2{
                center_difference.x < 0.0F ? -1.0F : 1.0F,
                0.0F,
            },
        };
    }

    return CollisionHit{
        .penetration = overlap_y,
        .normal = glm::vec2{
            0.0F,
            center_difference.y < 0.0F ? -1.0F : 1.0F,
        },
    };
}

CollisionHit circle_to_circle(Transform transform_a, Shape::circle_t a,
    Transform transform_b, Shape::circle_t b)
{
    const float a_radius = a.size / 2.0F;
    const float b_radius = b.size / 2.0F;

    const glm::vec2 a_center { transform_a.pos.x + a_radius,
        transform_a.pos.y + a_radius };
    const glm::vec2 b_center { transform_b.pos.x + b_radius,
        transform_b.pos.y + b_radius };
    const glm::vec2 difference = a_center - b_center;

    const float distance_squared = glm::dot(difference, difference);
    const float radius_sum = a_radius + b_radius;

    if (distance_squared >= radius_sum * radius_sum) {
        return CollisionHit {
            .penetration = 0.0F,
            .normal = glm::vec2 { 0, 1 },
        };
    }

    const float distance = std::sqrt(distance_squared);
    if (distance <= 0.0001F) {
        return {
            .penetration = radius_sum,
            .normal = { 1.0F, 0.0F },
        };
    }
    return {
        .penetration = radius_sum - distance,
        .normal = difference / distance,
    };
}

}
