/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/12 18:28:09 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <raylib.h>

#include "game/simulation.hpp"

namespace game::renderer {

namespace Colors {

#define COLORS                                                                 \
    X(COLOR_WHITE, 255, 255, 255, 255)                                         \
    X(COLOR_CYAN, 0x00, 0xE5, 0xFF, 255)                                       \
    X(COLOR_GREEN, 0x12, 0xEE, 0x83, 255)                                      \
    X(COLOR_PINK, 0xFF, 0x50, 0xDF, 255)                                       \
    X(COLOR_AMBER, 0xFF, 0xBB, 0x24, 255)                                      \
    X(COLOR_BACKGROUND, 0x0B, 0x08, 0x11, 255)                                 \
    X(COLOR_BLACK, 0, 0, 0, 255)

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

} // namespace Colors

class Renderer {
public:
    Renderer() = default;
    ~Renderer();
    void init();
    void draw(simulation::Simulation &simulation);
    void update_render_textures();

private:
    static void draw_progress_bar(glm::vec2 pos, glm::vec2 size,
        simulation::Color background, simulation::Color foreground, float value,
        float max_value);
    void apply_bloom();
    void render_scene(simulation::Simulation &sim);

    std::array<Texture, simulation::TankType::TANK_TYPE_MAX> tank_textures_;
    std::array<Texture, simulation::ProjectileType::PROJECTILE_TYPE_MAX>
        projectile_textures_;
    Font font_;

    int render_width_ = 800;
    int render_height_ = 600;

    RenderTexture2D scene_target_;
    RenderTexture2D bright_target_;
    RenderTexture2D blur_v_target_;
    RenderTexture2D blur_h_target_;

    Shader extract_shader_;
    Shader blur_shader_;
    Shader composite_shader_;

    int threshold_loc_;
    int texel_size_loc_;
    int direction_loc_;
    int bloom_texture_loc_;
    int intensity_loc_;
};

} // namespace game::renderer
