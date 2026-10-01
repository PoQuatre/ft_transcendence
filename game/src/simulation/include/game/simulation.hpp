/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.hpp                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:34 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/01 08:00:17 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <entt/entt.hpp>
#include <glm/ext/vector_float2.hpp>
#include <glm/ext/vector_float4.hpp>

namespace game::simulation {

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

struct Color {
    unsigned char r;
    unsigned char g;
    unsigned char b;
    unsigned char a;
};

struct Ball {
    Position pos;
    float size;
};

struct Projectile {
    float size;
};

struct Tank {
    std::string name;
    float size;
};

class Simulation {
public:
    Simulation();

    void update(float delta_seconds, int width, int height);
    [[nodiscard]] Ball ball() const;
    void create_player_tank(Tank &tank, Position pos, Color col);
    Velocity *get_player_velocity();
    Direction *get_player_direction();
    Position *get_player_position();
    Tank *get_player_tank();
    void fire_player_tank();
    entt::registry *get_registry() { return &registry_; };

private:
    entt::registry registry_;
    entt::entity ball_ { };
    entt::entity player_tank { };
};

} // namespace game::simulation
