/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   simulation_test.cpp                                :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:56:16 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/16 21:05:16 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include <catch2/catch_test_macros.hpp>

#include "game/simulation.hpp"

TEST_CASE("the ball starts at its configured position")
{
    const game::simulation::Simulation simulation;

    const auto ball = simulation.ball();
    CHECK(ball.x == 100.0F);
    CHECK(ball.y == 100.0F);
    CHECK(ball.size == 40.0F);
}

TEST_CASE("the ball moves and bounces from the window edges")
{
    game::simulation::Simulation simulation;

    simulation.update(1.0F, 800, 600);
    auto ball = simulation.ball();
    CHECK(ball.x == 340.0F);
    CHECK(ball.y == 280.0F);

    simulation.update(2.0F, 800, 600);
    ball = simulation.ball();
    CHECK(ball.x == 760.0F);
    CHECK(ball.y == 560.0F);

    simulation.update(1.0F, 800, 600);
    ball = simulation.ball();
    CHECK(ball.x == 520.0F);
    CHECK(ball.y == 380.0F);
}

TEST_CASE("the ball remains within a zero-sized canvas")
{
    game::simulation::Simulation simulation;

    simulation.update(0.0F, 0, 0);

    const auto ball = simulation.ball();
    CHECK(ball.x == 0.0F);
    CHECK(ball.y == 0.0F);
}

TEST_CASE("the ball remains within a canvas smaller than itself")
{
    game::simulation::Simulation simulation;

    simulation.update(0.0F, 39, 1);

    const auto ball = simulation.ball();
    CHECK(ball.x == 0.0F);
    CHECK(ball.y == 0.0F);
}

TEST_CASE("a horizontal bounce does not change vertical movement")
{
    game::simulation::Simulation simulation;

    simulation.update(1.0F, 200, 1'000);
    auto ball = simulation.ball();
    CHECK(ball.x == 160.0F);
    CHECK(ball.y == 280.0F);

    simulation.update(0.5F, 200, 1'000);
    ball = simulation.ball();
    CHECK(ball.x == 40.0F);
    CHECK(ball.y == 370.0F);
}
