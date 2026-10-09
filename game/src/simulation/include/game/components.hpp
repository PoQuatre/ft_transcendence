/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   components.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 14:29:13 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/08 02:08:00 by uanglade         ###   ########.fr       */
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

struct Position : glm::vec2 {
    using glm::vec2::vec2;

    explicit Position(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
    Position &operator=(const glm::vec2 &val)
    {
        this->x = val.x;
        this->y = val.y;
        return *this;
    }
};

struct Velocity : glm::vec2 {
    using glm::vec2::vec2;

    explicit Velocity(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
    Velocity &operator=(const glm::vec2 &val)
    {
        this->x = val.x;
        this->y = val.y;
        return *this;
    }
};

struct Direction : glm::vec2 {
    using glm::vec2::vec2;

    explicit Direction(const glm::vec2 &value)
        : glm::vec2(value)
    {
    }
    Direction &operator=(const glm::vec2 &val)
    {
        this->x = val.x;
        this->y = val.y;
        return *this;
    }
};

using Acceleration = glm::vec2;
// struct Acceleration : glm::vec2 {
//     using glm::vec2::vec2;
//
//     explicit Acceleration(const glm::vec2 &value)
//         : glm::vec2(value)
//     {
//     }
//     Acceleration &operator=(const glm::vec2 &val)
//     {
//         this->x = val.x;
//         this->y = val.y;
//         return *this;
//     }
// };

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

#define COLLISION_LAYER_PLAYER 1 << 0
#define COLLISION_LAYER_OBSTACLE 1 << 1
#define COLLISION_LAYER_RESSOURCE 1 << 2

struct PhysicalObject {
    float mass;
    float drag;
    float restitution;
    bool is_static;
    int mask;
    int layer;
    bool dirty = true;
};

}
