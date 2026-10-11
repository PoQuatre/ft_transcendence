/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   components.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 14:29:13 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/11 16:37:27 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <glm/ext/vector_float2.hpp>
#include <glm/ext/vector_float4.hpp>
#include <string>

namespace game::simulation {

namespace collision {
struct CollisionHit {
    float penetration;
    glm::vec2 normal;
};
};
// FIXME:
// using Position = glm::vec2
// casse entt tres tres bizarre

struct Transform {
    glm::vec2 pos;
    glm::vec2 vel;
    glm::vec2 acc;
    float rotation;
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
    float max_health;
};

namespace TankType {

#define TANK_TYPES                                                             \
    X(TANK_BASIC, CMAKE_SOURCE_DIR "/src/renderer/assets/simple_tank.svg")     \
    X(TANK_TWIN, CMAKE_SOURCE_DIR "/src/renderer/assets/twin_tank.svg")        \
    X(TANK_QUAD, CMAKE_SOURCE_DIR "/src/renderer/assets/quad_tank.svg")        \
    X(TANK_HEAVY, CMAKE_SOURCE_DIR "/src/renderer/assets/heavy_tank.svg")      \
    X(TANK_DRONE, CMAKE_SOURCE_DIR "/src/renderer/assets/drone_tank.svg")      \
    X(TANK_SNIPER, CMAKE_SOURCE_DIR "/src/renderer/assets/sniper_tank.svg")

enum type : uint8_t {
#define X(name, _) name,
    TANK_TYPES
#undef X
        TANK_TYPE_MAX,
};

constexpr std::array<std::string_view, TANK_TYPE_MAX> strings = {
#define X(name, _) #name,
    TANK_TYPES
#undef X
};

constexpr std::array<std::string_view, TANK_TYPE_MAX> paths = {
#define X(_, path) path,
    TANK_TYPES
#undef X
};

}

struct Tank {
    std::string name;
    float size;
    glm::vec2 dir;
};

enum State : uint8_t {
    STATE_DESTROYED,
    STATE_OK,
};

struct AABB {
    float min_x;
    float min_y;
    float max_x;
    float max_y;
};

#define COLLISION_LAYER_PLAYER                                                 \
    static_cast<uint32_t>(1) << static_cast<uint32_t>(0)
#define COLLISION_LAYER_OBSTACLE                                               \
    static_cast<uint32_t>(1) << static_cast<uint32_t>(1)
#define COLLISION_LAYER_RESSOURCE                                              \
    static_cast<uint32_t>(1) << static_cast<uint32_t>(2)

struct PhysicalObject {
    float mass;
    float drag;
    float restitution;
    bool is_static;
    uint32_t mask;
    uint32_t layer;
    bool dirty = true;
};

}
