#include <catch2/catch_test_macros.hpp>

#include "game/network.hpp"

TEST_CASE("network client checks framing and submits one batch")
{
    game::network::Client client;
    const std::array<std::uint8_t, 2> message { 4, 5 };
    REQUIRE_FALSE(client.append(game::protocol::Channel::Control, message));
    REQUIRE_FALSE(client.append(
        game::protocol::Channel::Event, std::array<std::uint8_t, 1025> { }));
    REQUIRE(client.append(game::protocol::Channel::State, message));
    int sends = 0;
    auto send = [&](std::span<const std::uint8_t> bytes) {
        ++sends;
        REQUIRE(std::vector<std::uint8_t>(bytes.begin(), bytes.end())
            == std::vector<std::uint8_t> { 2, 2, 0, 4, 5 });
        return true;
    };
    REQUIRE(client.submit(send));
    REQUIRE(client.submit(send));
    REQUIRE(sends == 1);

    int handled = 0;
    auto handler = [&](const game::protocol::Frame &) { ++handled; };
    REQUIRE(client.receive([](std::span<std::uint8_t>) { return 0; }, handler));
    REQUIRE(client.receive(
        [](std::span<std::uint8_t> bytes) {
            bytes[0] = 1;
            bytes[1] = 0;
            bytes[2] = 0;
            return 3;
        },
        handler));
    REQUIRE(handled == 0);
    REQUIRE_FALSE(client.receive(
        [](std::span<std::uint8_t> bytes) {
            bytes[0] = 1;
            bytes[1] = 2;
            bytes[2] = 0;
            return 3;
        },
        handler));
    REQUIRE_FALSE(client.receive(
        [](std::span<std::uint8_t> bytes) {
            bytes[0] = 0;
            bytes[1] = 0;
            bytes[2] = 0;
            return 3;
        },
        handler));
}
