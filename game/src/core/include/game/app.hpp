/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.hpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:59 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/01 13:24:10 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <spdlog/spdlog.h>

#include "game/platform.hpp"
#include "game/simulation.hpp"

template <>
struct fmt::formatter<glm::vec2> : fmt::formatter<std::string> {
    static auto format(glm::vec2 my, format_context &ctx) -> decltype(ctx.out())
    {
        return fmt::format_to(ctx.out(), "[vec x={}, y={}]", my.x, my.y);
    }
};

namespace game::core {

class App {
public:
    bool initialize();
    [[nodiscard]] static bool should_quit();
    void iterate();

private:
    platform::Platform platform_;
    simulation::Simulation simulation_;

    std::string tank_name_;
    void update_player();
};

} // namespace game::core
