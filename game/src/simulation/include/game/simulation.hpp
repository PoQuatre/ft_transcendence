/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:34 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/09 06:45:30 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <entt/entt.hpp>
#include <glm/ext/vector_float2.hpp>
#include <glm/ext/vector_float4.hpp>

#include "SpatialGrid.hpp"
#include "components.hpp"

namespace game::simulation {

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
    const SpatialGrid &get_quad_tree() { return quad_tree_; }

private:
    static collision::CollisionHit collide_objects(Transform transform_a,
        Shape shape_a, ShapeType type_a, Transform transform_b, Shape shape_b,
        ShapeType type_b);
    void resolve_collision(entt::entity a, entt::entity b,
        const collision::CollisionHit &collision);
    static AABB get_aabb(
        Transform transform, ShapeType shape_type, Shape shape);
    void update_physics(float delta_seconds);

    entt::registry registry_;
    entt::entity player_tank_;
    SpatialGrid quad_tree_;

    const int ressource_count_ = 100;
    const AABB map_bounds_
        = AABB { .min_x = -1000, .min_y = -1000, .max_x = 1000, .max_y = 1000 };
};

} // namespace game::simulation
