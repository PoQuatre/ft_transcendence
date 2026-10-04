/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.cpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:41 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/04 16:35:24 by uanglade         ###   ########.fr       */
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
    quad_tree_ = Quadtree(map_bounds_);
    std::random_device rd;
    std::uniform_real_distribution<float> random_pos(
        map_bounds_.min_x, map_bounds_.max_x);
    std::uniform_int_distribution<int> random_col(0, 255);
    std::uniform_int_distribution<int> random_shape_type(0, 1);
    std::uniform_int_distribution<int> random_shape_size(0, 100);

    for (int i = 0; i < ressource_count_; ++i) {
        Shape shape;
        ShapeType shape_type = random_shape_type(rd) == 0
            ? ShapeType::SHAPE_CIRCLE
            : ShapeType::SHAPE_RECT;
        if (shape_type == ShapeType::SHAPE_CIRCLE) {
            shape.circle.size = random_shape_size(rd);
        } else {
            shape.rect.width = random_shape_size(rd);
            shape.rect.height = shape.rect.width;
        }

        Position pos = { random_pos(rd), random_pos(rd) };
        Color col = { .r = static_cast<unsigned char>(random_col(rd)),
            .g = static_cast<unsigned char>(random_col(rd)),
            .b = static_cast<unsigned char>(random_col(rd)),
            .a = 255 };
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
        = physics_a.is_static ? 0.0F : 1.0F / physics_a.mass;
    const float inverse_mass_b
        = physics_b.is_static ? 0.0F : 1.0F / physics_b.mass;
    const float inverse_mass_sum = inverse_mass_a + inverse_mass_b;

    if (inverse_mass_sum <= 0.0F)
        return;

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

    const int simulation_steps = 3;
    const float sub_delta = delta_seconds / simulation_steps;
    const auto &view = registry_.view<Position, Velocity, Acceleration,
        PhysicalObject, ShapeType>();

    for (int step = 0; step < simulation_steps; ++step) {

        quad_tree_.clear();

        for (const auto entity : view) {
            auto &position = registry_.get<Position>(entity);
            auto &velocity = registry_.get<Velocity>(entity);
            auto &physics = registry_.get<PhysicalObject>(entity);
            auto &acceleration = registry_.get<Acceleration>(entity);

            velocity += acceleration * sub_delta;

            velocity *= std::max(0.0F, 1.0F - (physics.drag * sub_delta));

            if (!physics.is_static)
                position += velocity * sub_delta;

            const AABB bounds = get_aabb(entity);
            quad_tree_.insert(entity, bounds);
        }

        std::vector<entt::entity> candidates;

        for (const auto entity : view) {
            candidates.clear();

            const AABB bounds = get_aabb(entity);
            quad_tree_.query(bounds, candidates);

            auto &physics = registry_.get<PhysicalObject>(entity);
            auto &type_a = registry_.get<ShapeType>(entity);
            auto &shape_a = registry_.get<Shape>(entity);
            auto &pos_a = registry_.get<Position>(entity);

            for (const auto b : candidates) {
                if (entity == b)
                    continue;
                auto &physics_b = registry_.get<PhysicalObject>(b);
                if ((physics_b.layer & physics.mask) == 0)
                    continue;

                auto &type_b = registry_.get<ShapeType>(b);
                auto &shape_b = registry_.get<Shape>(b);
                auto &pos_b = registry_.get<Position>(b);

                const auto collision = collide_objects(
                    pos_a, shape_a, type_a, pos_b, shape_b, type_b);
                resolve_collision(b, entity, collision);
            }
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
            .restitution = 1.F,
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
    (void)this;
    const entt::entity ressource = registry_.create();
    // auto &tank = registry_.get<Tank>(player_tank);

    registry_.emplace<Position>(ressource, pos);
    registry_.emplace<Velocity>(ressource, glm::vec2 { 0, 0 });
    registry_.emplace<Color>(ressource, color);
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
    registry_.emplace<Position>(obstacle, pos);
    registry_.emplace<Velocity>(obstacle, glm::vec2 { 0, 0 });
    registry_.emplace<Color>(obstacle, color);
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

AABB Simulation::get_aabb(entt::entity entity)
{

    const auto &position = registry_.get<Position>(entity);
    const auto &shape_type = registry_.get<ShapeType>(entity);

    const auto &shape = registry_.get<Shape>(entity);
    switch (shape_type) {
    case ShapeType::SHAPE_CIRCLE:
        return { .min_x = position.x - shape.circle.size,
            .min_y = position.y - shape.circle.size,
            .max_x = position.x + shape.circle.size,
            .max_y = position.y + shape.circle.size };
    case ShapeType::SHAPE_RECT:
        return { .min_x = position.x - shape.rect.width,
            .min_y = position.y - shape.rect.height,
            .max_x = position.x + shape.rect.width,
            .max_y = position.y + shape.rect.height };
    }
    return { .min_x = 0, .min_y = 0, .max_x = 0, .max_y = 0 };
}

} // namespace game::simulation
