/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   network_client.cpp                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/31 01:11:07 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/31 02:40:09 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

#include <utility>

#include "game/network.hpp"

namespace game::network {

#ifdef __EMSCRIPTEN__

EM_JS(int, drain, (std::uint8_t *data, int size), {
    try {
        return Module.packetBridge.drain(HEAPU8.subarray(data, data + size));
    } catch (e) {
        Module.packetBridge.failure();
        return -1;
    }
});

EM_JS(int, submit, (const std::uint8_t *data, int size), {
    try {
        return Module.packetBridge.submit(HEAPU8.subarray(data, data + size));
    } catch (e) {
        Module.packetBridge.failure();
        return 0;
    }
});

EM_JS(int, status, (), { return Module.networkState(); });

EM_JS(void, failure, (), { Module.packetBridge.failure(); });

#endif

bool Client::append(protocol::Channel chan, std::span<const std::uint8_t> msg)
{
    const auto id = std::to_underlying(chan);
    const auto size = msg.size();
    if (id < 1 || id > 3 || size > max_packet_size)
        return false;

    outgoing_.reserve(outgoing_.size() + 3 + size);
    outgoing_.append_range(std::array {
        static_cast<std::uint8_t>(id),
        static_cast<std::uint8_t>(size),
        static_cast<std::uint8_t>(size >> 8U),
    });
    outgoing_.append_range(msg);
    return true;
}

bool Client::receive(const Drain &drain, const Handler &handler)
{
    const auto count = drain(ingoing_);
    if (count < 0 || static_cast<std::size_t>(count) > ingoing_.size())
        return false;

    const auto bytes = std::span(ingoing_).first(count);
    std::size_t offset = 0;

    while (offset < bytes.size()) {
        if (bytes.size() - offset < 3)
            return false;

        const auto id = bytes[offset];
        const auto size = static_cast<std::size_t>(bytes[offset + 1])
            | (static_cast<std::size_t>(bytes[offset + 2]) << 8U);
        offset += 3;

        if (id < 1 || id > 3 || size > max_packet_size || size > bytes.size() - offset)
            return false;

        const auto frame = protocol::parse_message(
            static_cast<protocol::Channel>(id), bytes.subspan(offset, size));
        if (frame)
            handler(*frame);
        offset += size;
    }
    return true;
}

bool Client::submit(const Submit &send)
{
    if (outgoing_.empty())
        return true;

    const auto res = send(outgoing_);
    outgoing_.clear();
    return res;
}

}
