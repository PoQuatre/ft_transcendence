/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.cpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:46 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/20 04:31:23 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/app.hpp"

#include <spdlog/spdlog.h>

#include "game/renderer.hpp"

namespace game::core {

bool App::initialize()
{
    if (!platform_.initialize()) {
        return false;
    }

    spdlog::info("Created an EnTT ball. Press Escape to quit.");
    return true;
}

bool App::should_quit()
{
    if (!platform::Platform::should_quit()) {
        return false;
    }

    spdlog::info("Quitting demo");
    return true;
}

void App::iterate()
{
    const double delta_seconds = platform_.delta_seconds();
    simulation_.update(delta_seconds, platform::Platform::width(),
        platform::Platform::height());
    renderer::Renderer::draw(simulation_.ball());
}

} // namespace game::core
