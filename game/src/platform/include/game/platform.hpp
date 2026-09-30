/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   platform.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/30 08:18:16 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <array>
#include <glm/common.hpp>
#include <glm/vec2.hpp>
#include <string>

namespace game::platform {

enum keys : uint8_t {
    KEY_NULL = 0,
    KEY_A,
    KEY_S,
    KEY_D,
    KEY_W,
    KEYBOARD_KEY_COUNT,
    MOUSE_BUTTON_LEFT,
    MOUSE_BUTTON_RIGHT,
    MOUSE_KEY_COUNT,
    KEY_COUNT,
};

struct input_state {
    std::array<bool, keys::KEY_COUNT> keys;
    std::array<bool, keys::KEY_COUNT> keys_first;
    glm::vec2 mouse_pos;
};

class Platform {
public:
    Platform() = default;
    Platform(const Platform &) = delete;
    Platform &operator=(const Platform &) = delete;
    ~Platform();

    bool initialize();
    [[nodiscard]] static bool should_quit();
    static double delta_seconds();
    [[nodiscard]] static int width();
    [[nodiscard]] static int height();
    void update_inputs();
    [[nodiscard]] input_state &get_input() { return state_; };

private:
    input_state state_ = { };
    double last_time_ { };
    bool initialized_ { };
};

} // namespace game::platform
