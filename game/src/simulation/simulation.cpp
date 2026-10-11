/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.cpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:41 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/11 20:43:53 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/simulation.hpp"

#include <spdlog/spdlog.h>

#include <algorithm>
#include <glm/geometric.hpp>
#include <random>

#include "game/platform.hpp"
#include "game/renderer.hpp"

namespace game::simulation {

Simulation::Simulation()
{
    std::random_device rd;
    std::default_random_engine eng(rd());

    std::uniform_real_distribution<float> random_pos(
        map_bounds_.min_x, map_bounds_.max_x);
    std::uniform_int_distribution<int> random_col(0, 3);
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

        Transform transform = {
            .pos { random_pos(eng), random_pos(eng) },
            .vel = glm::vec2(0),
            .acc = glm::vec2(0),
            .rotation = 0,
        };
        auto color_tmp = renderer::Colors::colors[1 + random_col(eng)];
        Color col = {
            .r = color_tmp.r,
            .g = color_tmp.b,
            .b = color_tmp.g,
            .a = color_tmp.a,
        };
        SPDLOG_INFO("Pos {} {}", transform.pos.x, transform.pos.y);
        SPDLOG_INFO("Col {} {} {}", col.r, col.g, col.b);
        SPDLOG_INFO("Shape {}", static_cast<int>(shape_type));

        create_ressource(transform, { .health = 100, .max_health = 100 }, shape,
            shape_type, col);
    }
}

void Simulation::update_physics(float delta_seconds)
{
    // const int simulation_steps = 10;
    const auto &view
        = registry_.view<Transform, PhysicalObject, ShapeType, Shape, State>();
    for (auto [entity, transform, physics, shape_type, shape, state] :
        view.each()) {

        transform.vel += transform.acc * delta_seconds;

        transform.vel *= std::max(0.0F, 1.0F - (physics.drag * delta_seconds));

        if (!physics.is_static) {
            transform.pos += transform.vel * delta_seconds;
        }
    }
}

void Simulation::update(float delta_seconds)
{
    update_physics(delta_seconds);

    for (const auto entity : registry_.view<Transform, Projectile>()) {
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

void Simulation::create_player_tank(Tank &tank, Transform transform, Color col)
{
    (void)this;
    player_tank_ = registry_.create();
    registry_.emplace<Transform>(player_tank_, transform);
    registry_.emplace<ShapeType>(player_tank_, ShapeType::SHAPE_TANK);
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
    registry_.emplace<Color>(player_tank_, col);
    registry_.emplace<Tank>(player_tank_, tank);
    registry_.emplace<State>(player_tank_, State::STATE_OK);
}

Transform *Simulation::get_player_transform()
{
    return &registry_.get<Transform>(player_tank_);
}

void Simulation::fire_player_tank()
{
    (void)this;
    const entt::entity bullet = registry_.create();
    auto &player_transform = registry_.get<Transform>(player_tank_);
    auto &player_dir = registry_.get<Tank>(player_tank_).dir;
    auto &player_col = registry_.get<Color>(player_tank_);
    // auto &tank = registry_.get<Tank>(player_tank);
    const float bullet_speed = 500.F;
    glm::vec2 bullet_vel = -player_dir * bullet_speed;

    registry_.emplace<Transform>(bullet,
        (Transform) {
            .pos = player_transform.pos,
            .vel = bullet_vel,
            .acc = glm::vec2(0),
            .rotation = 0,
        });
    registry_.emplace<Color>(bullet, player_col);
    registry_.emplace<Projectile>(bullet,
        Projectile {
            .damage = 10.F,
            .lifetime = 2.F,
            .creation_time = platform::Platform::get_time(),
            .type = ProjectileType::PROJECTILE_BASIC,
        });
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

void Simulation::create_ressource(Transform transform, Ressource res,
    Shape shape, ShapeType shape_type, Color color)
{
    entt::entity ressource = registry_.create();
    // auto &tank = registry_.get<Tank>(player_tank);

    registry_.emplace<Color>(ressource, color);
    registry_.emplace<Transform>(ressource, transform);
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
    Transform transform, Shape shape, ShapeType shape_type, Color color)
{
    (void)this;
    const entt::entity obstacle = registry_.create();
    registry_.emplace<Color>(obstacle, color);
    registry_.emplace<Transform>(obstacle, transform);
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

} // namespace game::simulation
