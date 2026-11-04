/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   network.hpp                                        :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/31 01:01:15 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/31 02:35:38 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <vector>

#include "game/protocol.hpp"

namespace game::network {

constexpr std::size_t bridge_header_size = 3;
constexpr std::size_t max_packet_size = 8192;
constexpr std::size_t max_incoming_bytes
    = (bridge_header_size + max_packet_size) * 32;

#ifdef __EMSCRIPTEN__
extern "C" int drain(std::uint8_t *data, int size);
extern "C" int submit(const std::uint8_t *data, int size);
extern "C" int status();
extern "C" void failure();
#endif

class Client {
public:
    using Handler = std::function<void(const protocol::Frame &)>;
    using Drain = std::function<int(std::span<std::uint8_t>)>;
    using Submit = std::function<bool(std::span<const std::uint8_t>)>;

    bool append(protocol::Channel chan, std::span<const std::uint8_t> msg);
    bool receive(const Drain &drain, const Handler &handler);
    bool submit(const Submit &send);
    [[nodiscard]] int status() const { return status_; }
    void set_status(int status) { status_ = status; }

private:
    std::array<std::uint8_t, max_incoming_bytes> ingoing_ { };
    std::vector<std::uint8_t> outgoing_;
    int status_ = 0;
};

} // namespace game::network
