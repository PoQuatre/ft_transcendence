/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.hpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:59 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/31 02:33:20 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <spdlog/spdlog.h>
#include <unordered_map>

#include "game/network.hpp"
#include "game/platform.hpp"
#include "game/renderer.hpp"
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
    renderer::Renderer renderer_;
    network::Client network_;

    std::string tank_name_;
    void update_player();
#ifdef __EMSCRIPTEN__
    void receive_frame(const protocol::Frame &frame);
    void send_input();
    std::unordered_map<std::uint32_t, entt::entity> entities_;
    std::uint32_t snapshot_id_ = 0;
    std::uint32_t input_id_ = 0;
    std::uint8_t generation_ = 0;
    bool synced_ = false;
    double input_elapsed_ = 0;
#endif
};

} // namespace game::core
