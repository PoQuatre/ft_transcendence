/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   raylib_platform.cpp                                :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/20 00:00:00 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/02 10:33:49 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif
#include <raylib.h>
#include <spdlog/spdlog.h>

#include "game/platform.hpp"

#ifdef __EMSCRIPTEN__
// clang-format off
EM_JS(int, observe_canvas_size, (), {
    const canvas = Module.canvas;
    if (!canvas)
        return 0;
    const observer = new ResizeObserver(([entry]) => {
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        if (width > 0 && height > 0)
            _game_resize_window(width, height);
    });
    observer.observe(canvas);
    canvas.gameResizeObserver = observer;
    return 1;
});
// clang-format on

// clang-format off
EM_JS(void, stop_observing_canvas_size, (), {
    Module.canvas?.gameResizeObserver?.disconnect();
});
// clang-format on

extern "C" EMSCRIPTEN_KEEPALIVE void game_resize_window(int width, int height)
{
    if (GetScreenWidth() != width || GetScreenHeight() != height)
        SetWindowSize(width, height);
}
#endif

namespace game::platform {

namespace {

constexpr int window_width = 800;
constexpr int window_height = 600;

} // namespace

Platform::~Platform()
{
#ifdef __EMSCRIPTEN__
    if (initialized_)
        stop_observing_canvas_size();
#endif

    if (initialized_)
        CloseWindow();
}

bool Platform::initialize()
{
    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_WINDOW_HIGHDPI);
    InitWindow(window_width, window_height, "raylib 6 + EnTT + spdlog");
    if (!IsWindowReady()) {
        spdlog::error("Window creation failed");
        return false;
    }
    initialized_ = true;

#ifdef __EMSCRIPTEN__
    SetExitKey(KEY_NULL);
    if (!observe_canvas_size()) {
        spdlog::error("Emscripten module requires a canvas");
        return false;
    }
#endif

    last_time_ = GetTime();
    return true;
}

bool Platform::should_quit() { return WindowShouldClose(); }

double Platform::delta_seconds() { return GetFrameTime(); }
double Platform::get_time() { return GetTime(); }
int Platform::width() { return GetRenderWidth(); }

int Platform::height() { return GetRenderHeight(); }

void Platform::update_inputs()
{
    std::array<KeyboardKey, keys::KEY_COUNT> checked_keys({
        KeyboardKey::KEY_A,
        KeyboardKey::KEY_S,
        KeyboardKey::KEY_D,
        KeyboardKey::KEY_W,
        KeyboardKey::KEY_LEFT_SHIFT,
    });

    for (size_t i = 0; i < keys::KEYBOARD_KEY_COUNT; ++i) {
        if (IsKeyDown(checked_keys[i]) && !state_.keys[i + 1]) {
            this->state_.keys[i + 1] = true;
            this->state_.keys_first[i + 1] = true;
        }
        if (IsKeyReleased(checked_keys[i])) {
            state_.keys[i + 1] = false;
            state_.keys_first[i + 1] = false;
        }
    }

    if (IsMouseButtonDown(MouseButton::MOUSE_BUTTON_LEFT)
        && !state_.keys[keys::MOUSE_BUTTON_LEFT]) {
        state_.keys[keys::MOUSE_BUTTON_LEFT] = true;
        state_.keys_first[keys::MOUSE_BUTTON_LEFT] = true;
    }
    if (IsMouseButtonReleased(MouseButton::MOUSE_BUTTON_LEFT)) {
        state_.keys[keys::MOUSE_BUTTON_LEFT] = false;
        state_.keys_first[keys::MOUSE_BUTTON_LEFT] = false;
    }
    if (IsMouseButtonDown(MouseButton::MOUSE_BUTTON_RIGHT)
        && !state_.keys[keys::MOUSE_BUTTON_RIGHT]) {
        state_.keys[keys::MOUSE_BUTTON_RIGHT] = true;
        state_.keys_first[keys::MOUSE_BUTTON_RIGHT] = true;
    }
    if (IsMouseButtonReleased(MouseButton::MOUSE_BUTTON_RIGHT)) {
        state_.keys[keys::MOUSE_BUTTON_RIGHT] = false;
        state_.keys_first[keys::MOUSE_BUTTON_RIGHT] = false;
    }

    state_.mouse_pos.x = GetMouseX();
    state_.mouse_pos.y = GetMouseY();
}

} // namespace game::platform
