/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:34 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/13 16:44:24 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <box2d/box2d.h>

#include <entt/entt.hpp>
#include <glm/ext/vector_float2.hpp>
#include <glm/ext/vector_float4.hpp>

#include "components.hpp"

namespace game::simulation {

const AABB map_bounds_
    = AABB { .min_x = -1000, .min_y = -1000, .max_x = 1000, .max_y = 1000 };

class Simulation {
public:
    Simulation();

    void update(float delta_seconds);
    void create_player_tank(Tank &tank, Transform transform, Color col);
    Transform *get_player_transform();
    Tank *get_player_tank() { return &registry_.get<Tank>(player_tank_); };
    void fire_player_tank();
    [[nodiscard]] entt::registry *get_registry() { return &registry_; };

    void create_ressource(Transform transform, Ressource res, Shape shape,
        ShapeType shape_type, Color color);
    void create_obstacle(
        Transform transform, Shape shape, ShapeType shape_type, Color color);

private:
    void update_physics(float delta_seconds);

    entt::registry registry_;
    entt::entity player_tank_;

    const int ressource_count_ = 100;
};

} // namespace game::simulation
