/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.cpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:41 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/08 23:13:33 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/simulation.hpp"

#include <spdlog/spdlog.h>

#include <algorithm>
#include <glm/geometric.hpp>
#include <random>

#include "game/collision.hpp"
#include "game/platform.hpp"

namespace game::simulation {

Simulation::Simulation()
{
    quad_tree_ = SpatialGrid(map_bounds_);
    std::random_device rd;
    std::default_random_engine eng(rd());

    std::uniform_real_distribution<float> random_pos(
        map_bounds_.min_x, map_bounds_.max_x);
    std::uniform_int_distribution<int> random_col(0, 255);
    std::uniform_int_distribution<int> random_shape_type(0, 1);
    std::uniform_int_distribution<int> random_shape_size(1, 100);

    for (int i = 0; i < ressource_count_; ++i) {
        Shape shape;
        ShapeType shape_type = random_shape_type(eng) == 0
            ? ShapeType::SHAPE_CIRCLE
            : ShapeType::SHAPE_RECT;
        if (shape_type == ShapeType::SHAPE_CIRCLE) {
            shape.circle.size = random_shape_size(eng);
        } else {
            shape.rect.width = random_shape_size(eng);
            shape.rect.height = shape.rect.width;
        }

        Position pos = { random_pos(eng), random_pos(eng) };
        Color col = {
            .r = static_cast<unsigned char>(random_col(eng)),
            .g = static_cast<unsigned char>(random_col(eng)),
            .b = static_cast<unsigned char>(random_col(eng)),
            .a = 255,
        };
        SPDLOG_INFO("Pos {} {}", pos.x, pos.y);
        SPDLOG_INFO("Col {} {} {}", col.r, col.g, col.b);
        SPDLOG_INFO("Shape {}", static_cast<int>(shape_type));

        create_ressource(
            pos, { .health = 100, .max_health = 100 }, shape, shape_type, col);
    }
}

collision::CollisionHit Simulation::collide_objects(Position pos_a,
    Shape shape_a, ShapeType type_a, Position pos_b, Shape shape_b,
    ShapeType type_b)
{

    if (type_a == ShapeType::SHAPE_CIRCLE) {
        if (type_b == ShapeType::SHAPE_RECT) {
            return collision::circle_to_rect(
                pos_a, shape_a.circle, pos_b, shape_b.rect);
        }
        if (type_b == ShapeType::SHAPE_CIRCLE) {
            return collision::circle_to_circle(
                pos_a, shape_a.circle, pos_b, shape_b.circle);
        }
    }
    if (type_a == ShapeType::SHAPE_RECT) {
        if (type_b == ShapeType::SHAPE_RECT) {
            return collision::rect_to_rect(
                pos_b, shape_b.rect, pos_a, shape_a.rect);
        }
        if (type_b == ShapeType::SHAPE_CIRCLE) {
            auto result = collision::circle_to_rect(
                pos_b, shape_b.circle, pos_a, shape_a.rect);
            result.normal = result.normal;
            return result;
        }
    }
    return collision::CollisionHit { };
}

void Simulation::resolve_collision(
    entt::entity a, entt::entity b, const collision::CollisionHit &collision)
{
    if (collision.penetration <= 0.001F) {
        return;
    }

    auto &position_a = this->registry_.get<Position>(a);
    auto &position_b = registry_.get<Position>(b);

    auto &velocity_a = registry_.get<Velocity>(a);
    auto &velocity_b = registry_.get<Velocity>(b);

    auto &physics_a = registry_.get<PhysicalObject>(a);
    auto &physics_b = registry_.get<PhysicalObject>(b);

    const float inverse_mass_a
        = physics_a.is_static ? 0.0F : 1.0F / (physics_a.mass + 0.00001F);
    const float inverse_mass_b
        = physics_b.is_static ? 0.0F : 1.0F / (physics_b.mass + 0.00001F);
    const float inverse_mass_sum = inverse_mass_a + inverse_mass_b;

    if (inverse_mass_sum <= 0.0F)
        return;

    physics_b.dirty = true;
    physics_a.dirty = true;

    const glm::vec2 correction
        = collision.normal * (collision.penetration / inverse_mass_sum);

    position_a -= correction * inverse_mass_a;
    position_b += correction * inverse_mass_b;

    const glm::vec2 relative_velocity = velocity_b - velocity_a;
    const float velocity_along_normal
        = glm::dot(relative_velocity, collision.normal);
    if (velocity_along_normal > 0.0F) {
        return;
    }

    const float restitution
        = std::min(physics_a.restitution, physics_b.restitution);
    const float impulse_magnitude
        = -(1.0F + restitution) * velocity_along_normal / inverse_mass_sum;
    const glm::vec2 impulse = collision.normal * impulse_magnitude;

    velocity_a -= impulse * inverse_mass_a;
    velocity_b += impulse * inverse_mass_b;

    auto *proj_a = registry_.try_get<Projectile>(a);
    auto *proj_b = registry_.try_get<Projectile>(b);
    auto *res_a = registry_.try_get<Ressource>(a);
    auto *res_b = registry_.try_get<Ressource>(b);
    if ((proj_a != nullptr && res_b != nullptr)) {
        res_b->health -= proj_a->damage;
        auto &state_a = registry_.get<State>(a);
        state_a = State::STATE_DESTROYED;
        return;
    }
    if ((proj_b != nullptr && res_a != nullptr)) {
        res_a->health -= proj_b->damage;
        auto &state_b = registry_.get<State>(b);
        state_b = State::STATE_DESTROYED;
        return;
    }
}

void Simulation::update_physics(float delta_seconds)
{
    const int simulation_steps = 4;
    const float sub_delta = delta_seconds / simulation_steps;
    const auto &view = registry_.view<Position, Velocity, Acceleration,
        PhysicalObject, ShapeType, Shape, State>();

    for (int step = 0; step < simulation_steps; ++step) {
        quad_tree_.clear();

        for (auto [entity, pos, vel, acc, physics, shape_type, shape, state] :
            view.each()) {

            vel += acc * sub_delta;

            vel *= std::max(0.0F, 1.0F - (physics.drag * sub_delta));

            if (!physics.is_static) {
                pos += vel * sub_delta;
            }
            const AABB bounds = get_aabb(pos, shape_type, shape);
            quad_tree_.insert(entity, bounds);
        }

        std::vector<entt::entity> candidates;

        for (auto [entity, pos, vel, acc, physics, shape_type, shape, state] :
            view.each()) {

            candidates.clear();

            const AABB bounds = get_aabb(pos, shape_type, shape);
            quad_tree_.query(bounds, candidates);

            for (auto entity_b_ : candidates) {
                if (entity == entity_b_)
                    continue;

                auto comp = view[entity_b_];
                auto pos_b = std::get<0>(comp);
                auto physics_b = std::get<3>(comp);
                auto shape_type_b = std::get<4>(comp);
                auto shape_b = std::get<5>(comp);

                if ((physics_b.layer & physics.mask) == 0)
                    continue;

                const auto collision = collide_objects(
                    pos, shape, shape_type, pos_b, shape_b, shape_type_b);
                resolve_collision(entity_b_, entity, collision);
            }

            physics.dirty = false;
        }
    }
}

void Simulation::update(float delta_seconds)
{
    update_physics(delta_seconds);

    for (const auto entity : registry_.view<Position, Velocity, Projectile>()) {
        auto &projectile = registry_.get<Projectile>(entity);

        if (platform::Platform::get_time() - projectile.creation_time
            > projectile.lifetime) {
            auto &state_proj = registry_.get<State>(entity);
            state_proj = State::STATE_DESTROYED;
        }
    }

    for (const auto entity : registry_.view<Ressource>()) {

        auto &state = registry_.get<State>(entity);
        auto &res = registry_.get<Ressource>(entity);
        if (res.health <= 0) {
            state = State::STATE_DESTROYED;
        }
    }

    for (const auto entity : registry_.view<State>()) {
        auto &state = registry_.get<State>(entity);

        if (state == State::STATE_DESTROYED) {
            registry_.destroy(entity);
        }
    }
}

void Simulation::create_player_tank(Tank &tank, Position pos, Color col)
{
    (void)this;
    player_tank_ = registry_.create();
    registry_.emplace<Position>(player_tank_, pos);
    registry_.emplace<Velocity>(player_tank_, Velocity { 0.F, 0.F });
    registry_.emplace<Acceleration>(player_tank_, Acceleration { 0.F, 0.F });
    registry_.emplace<ShapeType>(player_tank_, ShapeType::SHAPE_CIRCLE);
    registry_.emplace<Shape>(
        player_tank_, Shape { .circle = { .size = tank.size } });
    registry_.emplace<PhysicalObject>(player_tank_,
        PhysicalObject {
            .mass = 5.0F,
            .drag = 10.0F,
            .restitution = 0.2F,
            .is_static = false,
            .mask = COLLISION_LAYER_OBSTACLE | COLLISION_LAYER_RESSOURCE,
            .layer = COLLISION_LAYER_PLAYER,
        });
    registry_.emplace<Direction>(player_tank_, Direction { 0.F, 0.F });
    registry_.emplace<Color>(player_tank_, col);
    registry_.emplace<Tank>(player_tank_, tank);
    registry_.emplace<State>(player_tank_, State::STATE_OK);
}

Velocity *Simulation::get_player_velocity()
{
    return &registry_.get<Velocity>(player_tank_);
}

Acceleration *Simulation::get_player_acceleration()
{
    return &registry_.get<Acceleration>(player_tank_);
}

Direction *Simulation::get_player_direction()
{
    return &registry_.get<Direction>(player_tank_);
}

Position *Simulation::get_player_position()
{
    return &registry_.get<Position>(player_tank_);
}

void Simulation::fire_player_tank()
{
    (void)this;
    const entt::entity bullet = registry_.create();
    auto &player_pos = registry_.get<Position>(player_tank_);
    auto &player_dir = registry_.get<Direction>(player_tank_);
    auto &player_col = registry_.get<Color>(player_tank_);
    // auto &tank = registry_.get<Tank>(player_tank);
    const float bullet_speed = 1000.F;
    glm::vec2 bullet_vel = -player_dir * bullet_speed;

    registry_.emplace<Position>(bullet, player_pos);
    registry_.emplace<Velocity>(bullet, bullet_vel);
    registry_.emplace<Color>(bullet, player_col);
    registry_.emplace<Projectile>(
        bullet, 10.F, 2.F, platform::Platform::get_time());
    registry_.emplace<Acceleration>(bullet, Acceleration { 0.F, 0.F });
    registry_.emplace<ShapeType>(bullet, ShapeType::SHAPE_CIRCLE);
    registry_.emplace<Shape>(bullet, Shape { .circle = { .size = 10.F } });
    registry_.emplace<PhysicalObject>(bullet,
        PhysicalObject {
            .mass = 5.0F,
            .drag = 0.0F,
            .restitution = 1.F,
            .is_static = false,
            .mask = COLLISION_LAYER_OBSTACLE | COLLISION_LAYER_RESSOURCE,
            .layer = COLLISION_LAYER_PLAYER,
        });
    registry_.emplace<State>(bullet, State::STATE_OK);
}

void Simulation::create_ressource(
    Position pos, Ressource res, Shape shape, ShapeType shape_type, Color color)
{
    entt::entity ressource = registry_.create();
    // auto &tank = registry_.get<Tank>(player_tank);

    registry_.emplace<Color>(ressource, color);
    registry_.emplace<Position>(ressource, pos);
    registry_.emplace<Velocity>(ressource, glm::vec2 { 0, 0 });
    registry_.emplace<Acceleration>(ressource, Acceleration { 0.F, 0.F });
    registry_.emplace<ShapeType>(ressource, shape_type);
    registry_.emplace<Ressource>(ressource, res);
    registry_.emplace<Shape>(ressource, shape);

    registry_.emplace<PhysicalObject>(ressource,
        PhysicalObject {
            .mass = shape_type == ShapeType::SHAPE_CIRCLE ? shape.circle.size
                                                          : shape.rect.width,
            .drag = 15.0F,
            .restitution = 1.F,
            .is_static = false,
            .mask = COLLISION_LAYER_PLAYER | COLLISION_LAYER_OBSTACLE
                | COLLISION_LAYER_RESSOURCE,
            .layer = COLLISION_LAYER_RESSOURCE,
        });
    registry_.emplace<State>(ressource, State::STATE_OK);
}

void Simulation::create_obstacle(
    Position pos, Shape shape, ShapeType shape_type, Color color)
{
    (void)this;
    const entt::entity obstacle = registry_.create();
    registry_.emplace<Color>(obstacle, color);
    registry_.emplace<Position>(obstacle, pos);
    registry_.emplace<Velocity>(obstacle, glm::vec2 { 0, 0 });
    registry_.emplace<Acceleration>(obstacle, Acceleration { 0.F, 0.F });
    registry_.emplace<Shape>(obstacle, shape);
    registry_.emplace<ShapeType>(obstacle, shape_type);
    registry_.emplace<PhysicalObject>(obstacle,
        PhysicalObject {
            .mass = 10.0F,
            .drag = 5.0F,
            .restitution = 1.F,
            .is_static = true,
            .mask = COLLISION_LAYER_PLAYER | COLLISION_LAYER_OBSTACLE
                | COLLISION_LAYER_RESSOURCE,
            .layer = COLLISION_LAYER_OBSTACLE,
        });
    registry_.emplace<State>(obstacle, State::STATE_OK);
}

AABB Simulation::get_aabb(Position pos, ShapeType shape_type, Shape shape)
{

    switch (shape_type) {
    case ShapeType::SHAPE_CIRCLE:
        return {
            .min_x = pos.x,
            .min_y = pos.y,
            .max_x = pos.x + shape.circle.size,
            .max_y = pos.y + shape.circle.size,
        };
    case ShapeType::SHAPE_RECT:
        return {
            .min_x = pos.x,
            .min_y = pos.y,
            .max_x = pos.x + shape.rect.width,
            .max_y = pos.y + shape.rect.height,
        };
    }
    return { .min_x = 0, .min_y = 0, .max_x = 0, .max_y = 0 };
}

} // namespace game::simulation
