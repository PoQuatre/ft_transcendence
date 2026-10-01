/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:34 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/01 12:40:40 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <entt/entt.hpp>
#include <glm/ext/vector_float2.hpp>
#include <glm/ext/vector_float4.hpp>

namespace game::simulation {

namespace collision {
struct CollisionHit {
    float penetration;
    glm::vec2 normal;
};
};

struct Position : glm::vec2 {
    using glm::vec2::vec2;

    Position(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
};

struct Velocity : glm::vec2 {
    using glm::vec2::vec2;

    Velocity(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
};

struct Direction : glm::vec2 {
    using glm::vec2::vec2;

    Direction(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
};

struct Acceleration : glm::vec2 {
    using glm::vec2::vec2;

    Acceleration(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
};

struct Color {
    unsigned char r;
    unsigned char g;
    unsigned char b;
    unsigned char a;
};

enum ShapeType : uint8_t {
    SHAPE_CIRCLE,
    SHAPE_RECT,
};

struct Projectile {
    float damage;
    double lifetime;
    double creation_time;
};

union Shape {
    struct circle_t {
        float size;
    } circle;
    struct rect_t {
        float width;
        float height;
    } rect;
};

struct Ressource {
    float health;
};

struct Tank {
    std::string name;
    float size;
};

#define COLLISION_LAYER_PLAYER 1 << 0
#define COLLISION_LAYER_OBSTACLE 1 << 1

struct PhysicalObject {
    float mass;
    float drag;
    float restitution;
    bool is_static;
    int mask;
    int layer;
};

class Simulation {
public:
    Simulation() = default;

    void update(float delta_seconds, int width, int height);
    void create_player_tank(Tank &tank, Position pos, Color col);
    Velocity *get_player_velocity();
    Acceleration *get_player_acceleration();
    Direction *get_player_direction();
    Position *get_player_position();
    Tank *get_player_tank();
    void fire_player_tank();
    entt::registry *get_registry() { return &registry_; };

    void create_ressource(Position pos, Ressource res, Shape shape,
        ShapeType shape_type, Color color);
    void create_obstacle(
        Position pos, Shape shape, ShapeType shape_type, Color color);

private:
    collision::CollisionHit collide_objects(entt::entity a, entt::entity b);
    void resolve_collision(entt::entity a, entt::entity b,
        const collision::CollisionHit &collision);

    entt::registry registry_;
    entt::entity player_tank { };
};

} // namespace game::simulation
