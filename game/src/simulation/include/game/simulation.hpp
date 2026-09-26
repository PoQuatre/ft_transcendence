/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation.h                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:49:34 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/10 21:49:35 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <entt/entt.hpp>

namespace game::simulation {

struct Ball {
    float x;
    float y;
    float size;
};

class Simulation {
public:
    Simulation();

    void update(float delta_seconds, int width, int height);
    [[nodiscard]] Ball ball() const;

private:
    struct Position {
        float x;
        float y;
    };

    struct Velocity {
        float x;
        float y;
    };

    entt::registry registry_;
    entt::entity ball_ { };
};

} // namespace game::simulation
