#pragma once

#include <cstdint>
#include <optional>
#include <span>

namespace game::protocol {

constexpr std::uint16_t version = 1;

enum class Channel : std::uint8_t {
    Control,
    Event,
    State,
    Sync,
};

struct Frame {
    Channel channel;
    std::uint8_t packet_id;
    std::uint8_t session_generation;
    std::span<const std::uint8_t> payload;
};

std::optional<Frame> parse_message(
    Channel channel, std::span<const std::uint8_t> message);

} // namespace game::protocol
