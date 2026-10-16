/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/14 20:07:14 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <raylib.h>

#include "game/simulation.hpp"

namespace game::renderer {

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
    void update_camera(simulation::Simulation &sim);

    static void draw_grid();

    Camera2D camera_;

    std::array<Texture, simulation::TankType::TANK_TYPE_MAX> tank_textures_;
    std::array<Texture, simulation::ProjectileType::PROJECTILE_TYPE_MAX>
        projectile_textures_;
    Texture crosshair_;
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
