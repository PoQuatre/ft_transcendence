/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   colors.hpp                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/14 20:06:01 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/14 20:08:58 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <array>
#include <cstdint>
#include <string_view>

#include "raylib.h"

namespace game::renderer::Colors {

#define COLORS                                                                 \
    X(COLOR_WHITE, 0xFF, 0xFF, 0xFF, 0xFF)                                     \
    X(COLOR_CYAN, 0x00, 0xE5, 0xFF, 0xFF)                                      \
    X(COLOR_GREEN, 0x12, 0xEE, 0x83, 0xFF)                                     \
    X(COLOR_PINK, 0xFF, 0x50, 0xDF, 0xFF)                                      \
    X(COLOR_AMBER, 0xFF, 0xBB, 0x24, 0xFF)                                     \
    X(COLOR_BACKGROUND, 0x0B, 0x08, 0x11, 0xFF)                                \
    X(COLOR_GRID, 0x16, 0x10, 0x22, 0xFF)                                      \
    X(COLOR_BLACK, 0x00, 0x00, 0x00, 0xFF)

enum type : uint8_t {
#define X(name, _, __, ___, ____) name,
    COLORS
#undef X
        COLORS_MAX,
};

constexpr std::array<std::string_view, COLORS_MAX> strings = {
#define X(name, _, __, ___, ____) #name,
    COLORS
#undef X
};

constexpr std::array<Color, COLORS_MAX> colors = {
#define X(_, r, g, b, a) Color { r, g, b, a },
    COLORS
#undef X
};

#undef COLORS

} // namespace game::renderer::Colors
