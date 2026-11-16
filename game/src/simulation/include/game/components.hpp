/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   components.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 14:29:13 by uanglade          #+#    #+#             */
/*   Updated: 2026/11/16 17:34:49 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <glm/ext/vector_float2.hpp>
#include <glm/ext/vector_float4.hpp>
#include <string>

#include "raylib.h"

namespace game::simulation {

namespace collision {
struct CollisionHit {
    float penetration;
    glm::vec2 normal;
};
};

struct Transform {
    glm::vec2 pos;
    glm::vec2 vel;
    glm::vec2 acc;
    float rotation;
};

enum ShapeType : uint8_t {
    SHAPE_CIRCLE,
    SHAPE_RECT,
    SHAPE_TANK,
};

namespace ProjectileType {

#define PROJECTILE_TYPES                                                       \
    X(PROJECTILE_BASIC,                                                        \
        CMAKE_SOURCE_DIR                                                       \
        "/src/renderer/assets/textures/bullet_projectile.svg",                 \
        7, 7)

enum type : uint8_t {
#define X(name, _, __, ___) name,
    PROJECTILE_TYPES
#undef X
        PROJECTILE_TYPE_MAX,
};

constexpr std::array<std::string_view, PROJECTILE_TYPE_MAX> strings = {
#define X(name, _, __, ___) #name,
    PROJECTILE_TYPES
#undef X
};

constexpr std::array<std::string_view, PROJECTILE_TYPE_MAX> paths = {
#define X(_, path, __, ___) path,
    PROJECTILE_TYPES
#undef X
};

constexpr std::array<glm::vec2, PROJECTILE_TYPE_MAX> origins = {
#define X(_, ___, x, y) glm::vec2(x, y),
    PROJECTILE_TYPES
#undef X
};

#undef PROJECTILE_TYPES

}

struct Projectile {
    float damage;
    double lifetime;
    double creation_time;
    ProjectileType::type type;
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

struct Health {
    float value;
    float maximum;
};

struct PointLight {
    float radius;
    Color color;
    float intensity;
    bool cast_shadows = true;
};

namespace TankType {

#define TANK_TYPES                                                             \
    X(TANK_BASIC,                                                              \
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/simple_tank.svg", 28,  \
        28, 79, 56)                                                            \
    X(TANK_TWIN,                                                               \
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/twin_tank.svg", 28,    \
        25, 82, 50)                                                            \
    X(TANK_QUAD,                                                               \
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/quad_tank.svg", 54,    \
        54, 108, 108)                                                          \
    X(TANK_HEAVY,                                                              \
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/heavy_tank.svg", 34,   \
        34, 90, 68)                                                            \
    X(TANK_DRONE,                                                              \
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/drone_tank.svg", 35,   \
        53, 70, 106)                                                           \
    X(TANK_SNIPER,                                                             \
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/sniper_tank.svg", 25,  \
        25, 95, 50)

enum type : uint8_t {
#define X(name, _, __, ___, ____, _____) name,
    TANK_TYPES
#undef X
        TANK_TYPE_MAX,
};

constexpr std::array<std::string_view, TANK_TYPE_MAX> strings = {
#define X(name, _, __, ___, ____, _____) #name,
    TANK_TYPES
#undef X
};

constexpr std::array<std::string_view, TANK_TYPE_MAX> paths = {
#define X(_, path, __, ___, ____, _____) path,
    TANK_TYPES
#undef X
};

constexpr std::array<glm::vec2, TANK_TYPE_MAX> origins = {
#define X(_, ___, x, y, ____, _____) glm::vec2(x, y),
    TANK_TYPES
#undef X
};

constexpr std::array<glm::vec2, TANK_TYPE_MAX> sizes = {
#define X(_, ___, ____, _____, x, y) glm::vec2(x, y),
    TANK_TYPES
#undef X
};

#undef TANK_TYPES

}

struct Tank {
    std::string name;
    float size;
    glm::vec2 dir;
    TankType::type type;
    float max_energy;
    float energy;
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
