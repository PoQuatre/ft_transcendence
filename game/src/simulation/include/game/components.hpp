/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   components.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 14:29:13 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/09 06:49:55 by uanglade         ###   ########.fr       */
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
