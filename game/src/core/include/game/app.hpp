/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   app.hpp                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:59 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/20 02:05:11 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include "game/platform.hpp"
#include "game/simulation.hpp"

namespace game::core {

class App {
public:
    bool initialize();
    [[nodiscard]] static bool should_quit();
    void iterate();

private:
    platform::Platform platform_;
    simulation::Simulation simulation_;
};

} // namespace game::core
