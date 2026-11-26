/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.cpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:30 by mle-flem          #+#    #+#             */
/*   Updated: 2026/11/18 05:54:18 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/renderer.hpp"

#include <nanosvg.h>
#include <nanosvgrast.h>
#include <raylib.h>
#include <spdlog/spdlog.h>

#include <array>
#include <cmath>
#include <glm/common.hpp>
#include <glm/geometric.hpp>
#include <glm/vec3.hpp>

#include "game/colors.hpp"
#include "game/simulation.hpp"

namespace {

float display_scale()
{
#ifdef __EMSCRIPTEN__
    return GetWindowScaleDPI().x;
#else
    return 1.0F;
#endif
}

// CREDIT: raysan5
// https://github.com/raylib-extras/examples-c/commit/1e38dd9f1ae84c3beafecf69a7002a9339d1b4e9#diff-820f8b79e6e180ac315cc1f221bc5e98b0cf240210b96e9b860bc94cd5d3ec84
// Load SVG image, rasteraizing it at desired width and height
// NOTE: If width/height are 0, using internal default width/height
Image LoadImageSVG(const char *fileName, int width, int height)
{
    Image image = { };

    if ((strcmp(GetFileExtension(fileName), ".svg") == 0)
        || (strcmp(GetFileExtension(fileName), ".SVG") == 0)) {
        int dataSize = 0;
        unsigned char *fileData = nullptr;

        fileData = LoadFileData(fileName, &dataSize);

        // Make sure the file data contains an EOL character: '\0'
        if ((dataSize > 0) && (fileData[dataSize - 1] != '\0')) {
            auto *tmp = static_cast<unsigned char *>(
                RL_REALLOC(fileData, dataSize + 1));
            fileData = tmp;
            fileData[dataSize] = '\0';
            dataSize += 1;
        }

        // Validate fileData as valid SVG string data
        //<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="2484"
        // viewBox="0 0 192.756 191.488">
        if ((fileData != nullptr) && (fileData[0] == '<')
            && (fileData[1] == 's') && (fileData[2] == 'v')
            && (fileData[3] == 'g')) {
            struct NSVGimage *svgImage
                = nsvgParse(reinterpret_cast<char *>(fileData), "px", 96.0F);
            auto *imgData = static_cast<unsigned char *>(
                RL_MALLOC(svgImage->width * svgImage->height * 4));

            // NOTE: If required width or height is 0, using default SVG
            // internal value
            if (width == 0)
                width = svgImage->width;
            if (height == 0)
                height = svgImage->height;

            // Calculate scales for both the width and the height
            float scaleWidth = width / svgImage->width;
            float scaleHeight = height / svgImage->height;

            // Set the largest of the 2 scales to be the scale to use
            float scale = (scaleHeight > scaleWidth) ? scaleWidth : scaleHeight;

            int offsetX = 0;
            int offsetY = 0;

            if (scaleHeight > scaleWidth)
                offsetY = (height - (svgImage->height * scale)) / 2;
            else
                offsetX = (width - (svgImage->width * scale)) / 2;

            // Rasterize
            struct NSVGrasterizer *rast = nsvgCreateRasterizer();
            nsvgRasterize(rast, svgImage, offsetX, offsetY, scale, imgData,
                width, height, width * 4);

            // Populate image struct with all data
            image.data = imgData;
            image.width = width;
            image.height = height;
            image.mipmaps = 1;
            image.format = PIXELFORMAT_UNCOMPRESSED_R8G8B8A8;

            nsvgDelete(svgImage);
            nsvgDeleteRasterizer(rast);
        }

        UnloadFileData(fileData);
    }

    return image;
}

};

namespace game::renderer {

namespace {
void recolor_red_outline(Image *image, Color target_color)
{
    for (int y = 0; y < image->height; ++y) {
        for (int x = 0; x < image->width; ++x) {
            Color pixel = GetImageColor(*image, x, y);

            if (pixel.r == 0 && pixel.g == 0 && pixel.b == 0) {
                ImageDrawPixel(image, x, y, BLANK);
                continue;
            }

            if (pixel.r > 0 && pixel.g == 0 && pixel.b == 0) {
                // const uint8_t shade = pixel.r;
                //
                // Color new_color = {
                //     .r = static_cast<uint8_t>((target_color.r * shade) /
                //     255), .g = static_cast<uint8_t>((target_color.g * shade)
                //     / 255), .b = static_cast<uint8_t>((target_color.b *
                //     shade) / 255), .a = pixel.a,
                // };

                ImageDrawPixel(image, x, y, target_color);
            }
        }
    }
}
}

void Renderer::init()
{
    std::array<Image, simulation::TankType::TANK_TYPE_MAX> base_tank_textures;
    std::array<Image, simulation::ProjectileType::PROJECTILE_TYPE_MAX>
        base_projectile_textures;

    size_t i = 0;
    for (const auto &path : simulation::TankType::paths) {
        const std::string path_copy(path);
        // const uint32_t load_scale = 2.0;
        SPDLOG_INFO("loading texture {}", path_copy);
        Image image = LoadImageSVG(path_copy.c_str(),
            simulation::TankType::sizes[i].x, simulation::TankType::sizes[i].y);
        ImageResize(&image, image.width, image.height);
        base_tank_textures[i] = image;
        ++i;
    }

    i = 0;
    for (const auto &base_texture : base_tank_textures) {
        for (uint32_t j = 0; j < tank_teams_count; ++j) {
            Image colored_image = ImageCopy(base_texture);
            recolor_red_outline(&colored_image, Colors::colors[j]);
            ImageResize(&colored_image, 0.5 * colored_image.width,
                0.5 * colored_image.height);
            tank_textures_[i][j] = LoadTextureFromImage(colored_image);
            UnloadImage(colored_image);
        }
        UnloadImage(base_texture);
        ++i;
    }

    i = 0;
    for (const auto &path : simulation::ProjectileType::paths) {
        const std::string path_copy(path);
        SPDLOG_INFO("loading texture {}", path_copy);
        Image image = LoadImageSVG(path_copy.c_str(), 0, 0);
        ImageResize(&image, 0.5 * image.width, 0.5 * image.height);
        base_projectile_textures[i] = image;
        ++i;
    }

    i = 0;
    for (const auto &base_texture : base_projectile_textures) {
        for (uint32_t j = 0; j < tank_teams_count; ++j) {
            Image colored_image = ImageCopy(base_texture);
            recolor_red_outline(&colored_image, Colors::colors[j]);
            projectile_textures_[i][j] = LoadTextureFromImage(colored_image);
            UnloadImage(colored_image);
        }
        UnloadImage(base_texture);
        ++i;
    }

    font_ = LoadFont(
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/space_grotesk.ttf");
    Image crosshair_image = LoadImageSVG(
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/crosshair.svg", 0, 0);
    ImageColorReplace(&crosshair_image, Colors::colors[Colors::COLOR_BLACK],
        Colors::colors[Colors::COLOR_TRANSPARENT]);
    ImageResize(&crosshair_image, 0.5 * crosshair_image.width,
        0.5 * crosshair_image.height);
    crosshair_ = LoadTextureFromImage(crosshair_image);
    UnloadImage(crosshair_image);
    update_render_textures();

    extract_shader_ = LoadShader(nullptr,
        CMAKE_SOURCE_DIR "/src/renderer/assets/shaders/bloom_extract.fs");
    blur_shader_ = LoadShader(
        nullptr, CMAKE_SOURCE_DIR "/src/renderer/assets/shaders/bloom_blur.fs");
    composite_shader_ = LoadShader(nullptr,
        CMAKE_SOURCE_DIR "/src/renderer/assets/shaders/bloom_composite.fs");
    light_map_shader_ = LoadShader(CMAKE_SOURCE_DIR
        "/src/renderer/assets/shaders/light_map.vs",
        CMAKE_SOURCE_DIR "/src/renderer/assets/shaders/light_map.fs");

    threshold_loc_ = GetShaderLocation(extract_shader_, "threshold");
    texel_size_loc_ = GetShaderLocation(blur_shader_, "texelSize");
    direction_loc_ = GetShaderLocation(blur_shader_, "direction");
    bloom_texture_loc_ = GetShaderLocation(composite_shader_, "bloomTexture");
    intensity_loc_ = GetShaderLocation(composite_shader_, "bloomIntensity");
    light_map_texture_loc_ = GetShaderLocation(composite_shader_, "lightMap");
    shadow_map_texture_loc_ = GetShaderLocation(light_map_shader_, "shadowMap");
}

Renderer::~Renderer()
{
    for (size_t i = 0; i < simulation::TankType::paths.size(); ++i) {
        for (size_t j = 0; j < tank_teams_count; ++j) {
            UnloadTexture(tank_textures_[i][j]);
        }
    }

    for (size_t i = 0; i < simulation::ProjectileType::paths.size(); ++i) {
        for (size_t j = 0; j < tank_teams_count; ++j) {
            UnloadTexture(tank_textures_[i][j]);
        }
    }
    UnloadFont(font_);
    UnloadTexture(crosshair_);

    UnloadRenderTexture(light_map_);
    UnloadRenderTexture(shadow_map_);
    UnloadRenderTexture(scene_target_);
    UnloadRenderTexture(bright_target_);
    UnloadRenderTexture(blur_v_target_);
    UnloadRenderTexture(blur_h_target_);
    UnloadRenderTexture(ui_target_);

    UnloadShader(extract_shader_);
    UnloadShader(blur_shader_);
    UnloadShader(composite_shader_);
    UnloadShader(light_map_shader_);
}

void Renderer::update_render_textures()
{
    if (render_width_ != GetRenderWidth()
        || render_height_ != GetRenderHeight()) {

        render_width_ = GetRenderWidth();
        render_height_ = GetRenderHeight();

        UnloadRenderTexture(light_map_);
        UnloadRenderTexture(shadow_map_);
        UnloadRenderTexture(scene_target_);
        UnloadRenderTexture(bright_target_);
        UnloadRenderTexture(blur_v_target_);
        UnloadRenderTexture(blur_h_target_);
        UnloadRenderTexture(ui_target_);

        light_map_ = LoadRenderTexture(render_width_, render_height_);
        shadow_map_ = LoadRenderTexture(render_width_, render_height_);
        scene_target_ = LoadRenderTexture(render_width_, render_height_);
        bright_target_ = LoadRenderTexture(render_width_, render_height_);
        blur_v_target_ = LoadRenderTexture(render_width_, render_height_);
        blur_h_target_ = LoadRenderTexture(render_width_, render_height_);
        ui_target_ = LoadRenderTexture(render_width_, render_height_);
    }
}

void Renderer::draw(simulation::Simulation &sim)
{
    update_render_textures();
    update_camera(sim);

    render_scene(sim);

    apply_bloom();

    float bloom_intensity = 3.2F;

    draw_ui(sim);

    BeginDrawing();
    ClearBackground(Colors::colors[Colors::COLOR_BACKGROUND]);

    BeginShaderMode(composite_shader_);
    SetShaderValue(composite_shader_, intensity_loc_, &bloom_intensity,
        SHADER_UNIFORM_FLOAT);
    SetShaderValueTexture(
        composite_shader_, bloom_texture_loc_, blur_v_target_.texture);
    SetShaderValueTexture(
        composite_shader_, light_map_texture_loc_, light_map_.texture);
    SetShaderValueTexture(composite_shader_,
        GetShaderLocation(composite_shader_, "uiTexture"), ui_target_.texture);

    DrawTextureRec(scene_target_.texture,
        Rectangle {
            .x = 0,
            .y = 0,
            .width = static_cast<float>(scene_target_.texture.width),
            .height = -static_cast<float>(scene_target_.texture.height),
        },
        Vector2 { .x = 0, .y = 0 }, WHITE);

    EndShaderMode();

    BeginMode2D(Camera2D {
        .offset = { },
        .target = { },
        .rotation = 0,
        .zoom = display_scale(),
    });
    DrawFPS(8, 8);
    EndMode2D();

    EndDrawing();
}

void Renderer::render_scene(simulation::Simulation &sim)
{
    auto *registry = sim.get_registry();

    BeginTextureMode(scene_target_);
    ClearBackground(Colors::colors[Colors::COLOR_BACKGROUND]);
    BeginMode2D(camera_);

    draw_grid();

    std::vector<std::pair<glm::vec2, glm::vec2>> shadow_segments;
    std::vector<entt::entity> circles;

    for (const auto entity : registry
             ->view<Colors::type, simulation::Transform, simulation::ShapeType>(
                 entt::exclude<simulation::Projectile>)) {

        const auto &transform = registry->get<simulation::Transform>(entity);
        const auto &color = registry->get<Colors::type>(entity);

        const auto &shape_type = registry->get<simulation::ShapeType>(entity);
        const auto &shape = registry->get<simulation::Shape>(entity);

        const auto *res = registry->try_get<simulation::Ressource>(entity);

        switch (shape_type) {
        case simulation::ShapeType::SHAPE_RECT: {
            const glm::vec2 half { shape.rect.width / 2.F,
                shape.rect.height / 2.F };
            const glm::vec2 center = transform.pos + half;
            const float c = std::cos(transform.rotation);
            const float s = std::sin(transform.rotation);
            const auto corners = std::array {
                glm::vec2 { -half.x, -half.y },
                glm::vec2 { half.x, -half.y },
                glm::vec2 { half.x, half.y },
                glm::vec2 { -half.x, half.y },
            };
            for (int i = 0; i < 4; ++i) {
                auto a = corners[i];
                auto b = corners[(i + 1) % 4];
                a = {
                    center.x + (a.x * c) - (a.y * s),
                    center.y + (a.x * s) + (a.y * c),
                };
                b = {
                    center.x + (b.x * c) - (b.y * s),
                    center.y + (b.x * s) + (b.y * c),
                };

                DrawLineV(
                    {
                        .x = a.x,
                        .y = a.y,
                    },
                    {
                        .x = b.x,
                        .y = b.y,
                    },
                    Colors::colors[color]);
                shadow_segments.emplace_back(a, b);
            }
            if (res != nullptr && res->health != res->max_health) {
                Renderer::draw_progress_bar(
                    {
                        transform.pos.x,
                        transform.pos.y + shape.rect.height + 4,
                    },
                    { 20, 10 }, Colors::COLOR_WHITE, Colors::COLOR_BLACK,
                    res->health, res->max_health);
            }
            break;
        }
        case simulation::ShapeType::SHAPE_CIRCLE:
            circles.push_back(entity);
            DrawCircleLinesV(
                Vector2 {
                    .x = transform.pos.x + (shape.circle.size / 2.0F),
                    .y = transform.pos.y + (shape.circle.size / 2.0F),
                },
                shape.circle.size / 2.0F, Colors::colors[color]);
            if (res != nullptr && res->health != res->max_health) {
                Renderer::draw_progress_bar(
                    { transform.pos.x,
                        transform.pos.y + shape.circle.size + 4 },
                    { 20, 10 }, Colors::COLOR_WHITE, Colors::COLOR_BLACK,
                    res->health, res->max_health);
            }
            break;
        default:
            break;
        }
    }

    for (const auto entity : registry->view<Colors::type, simulation::Transform,
             simulation::Projectile>()) {
        const auto &transform = registry->get<simulation::Transform>(entity);
        const auto &color = registry->get<Colors::type>(entity);
        const auto &proj = registry->get<simulation::Projectile>(entity);

        float rot = (transform.rotation + M_PI) * RAD2DEG;
        Texture texture = projectile_textures_[proj.type][color];
        Rectangle source = {
            .x = 0.0F,
            .y = 0.0F,
            .width = static_cast<float>(texture.width),
            .height = static_cast<float>(texture.height),
        };

        Rectangle dest = {
            .x = transform.pos.x,
            .y = transform.pos.y,
            .width = static_cast<float>(texture.width),
            .height = static_cast<float>(texture.height),
        };

        Vector2 origin {
            .x = static_cast<float>(
                simulation::ProjectileType::origins[proj.type].x * 0.5),
            .y = static_cast<float>(
                simulation::ProjectileType::origins[proj.type].y * 0.5),
        };

        DrawTexturePro(texture, source, dest, origin, rot, WHITE);
    }

    for (const auto entity : registry
             ->view<simulation::Tank, Colors::type, simulation::Transform>()) {

        const auto &transform = registry->get<simulation::Transform>(entity);
        const auto &tank = registry->get<simulation::Tank>(entity);
        const auto &color = registry->get<Colors::type>(entity);
        const auto &direction = tank.dir;

        float rot = (atan2(direction.y, direction.x) + M_PI) * RAD2DEG;
        Texture texture = tank_textures_[tank.type][color];
        Rectangle source = {
            .x = 0.0F,
            .y = 0.0F,
            .width = static_cast<float>(texture.width),
            .height = static_cast<float>(texture.height),
        };

        Rectangle dest = {
            .x = transform.pos.x,
            .y = transform.pos.y,
            .width = static_cast<float>(texture.width),
            .height = static_cast<float>(texture.height),
        };

        Vector2 origin {
            .x = static_cast<float>(
                simulation::TankType::origins[tank.type].x * 0.5),
            .y = static_cast<float>(
                simulation::TankType::origins[tank.type].y * 0.5),
        };

        DrawTexturePro(texture, source, dest, origin, rot, WHITE);

        if (const auto *health = registry->try_get<simulation::Health>(entity);
            health != nullptr && health->value < health->maximum
            && entity != sim.get_player()) {
            draw_progress_bar({ transform.pos.x - 20, transform.pos.y + 20 },
                { 40, 6 }, Colors::COLOR_WHITE, Colors::COLOR_RED,
                health->value, health->maximum);
        }
    }

    for (const auto entity : registry
             ->view<simulation::Tank, Colors::type, simulation::Transform>()) {
        const auto &transform = registry->get<simulation::Transform>(entity);
        const auto &tank = registry->get<simulation::Tank>(entity);
        const auto &color = registry->get<Colors::type>(entity);
        Texture texture = tank_textures_[tank.type][color];
        const float font_size = 15;
        DrawTextEx(font_, tank.name.c_str(),
            {
                .x = transform.pos.x - ((tank.name.size() / 2.F) + font_size),
                .y = transform.pos.y - (texture.height + font_size),
            },
            font_size, 2, Colors::colors[Colors::COLOR_WHITE]);
    }

    const Vector2 mouse_screen = GetMousePosition();
    const Vector2 mouse_world_raylib
        = GetScreenToWorld2D(mouse_screen, camera_);
    DrawTexture(crosshair_, mouse_world_raylib.x - (crosshair_.width / 2.F),
        mouse_world_raylib.y - (crosshair_.height / 2.F), WHITE);

    EndMode2D();
    EndTextureMode();

    draw_shadow_map(sim, shadow_segments, circles);
}

namespace {

std::array<glm::vec2, 4> project_shadow(
    const std::pair<glm::vec2, glm::vec2> &segment, glm::vec2 light_position,
    float projection_distance)
{
    const glm::vec2 a = segment.first;
    const glm::vec2 b = segment.second;

    const glm::vec2 dir_a { a.x - light_position.x, a.y - light_position.y };

    const glm::vec2 dir_b { b.x - light_position.x, b.y - light_position.y };

    const glm::vec2 projected_a { a.x + (dir_a.x * projection_distance),
        a.y + (dir_a.y * projection_distance) };

    const glm::vec2 projected_b { b.x + (dir_b.x * projection_distance),
        b.y + (dir_b.y * projection_distance) };

    return { a, b, projected_b, projected_a };
}

void draw_shadow_quad(std::array<glm::vec2, 4> &quad)
{
    DrawTriangle({ .x = quad[0].x, .y = quad[0].y },
        { .x = quad[1].x, .y = quad[1].y }, { .x = quad[2].x, .y = quad[2].y },
        Colors::colors[Colors::COLOR_BLACK]);
    DrawTriangle({ .x = quad[0].x, .y = quad[0].y },
        { .x = quad[2].x, .y = quad[2].y }, { .x = quad[3].x, .y = quad[3].y },
        Colors::colors[Colors::COLOR_BLACK]);
}

std::optional<std::pair<glm::vec2, glm::vec2>> get_circle_segment(
    glm::vec2 light_pos, glm::vec2 circle_pos, float radius)
{
    const glm::vec2 pos(circle_pos.x + radius, circle_pos.y + radius);
    const glm::vec2 to_light = light_pos - pos;
    const float distance_squared = glm::dot(to_light, to_light);
    const float radius_squared = radius * radius;
    if (distance_squared <= radius_squared)
        return std::nullopt;

    const float distance = std::sqrt(distance_squared);
    const float base_angle = std::atan2(to_light.y, to_light.x);
    const float tangent_angle = std::acos(radius / distance);

    const float angle_a = base_angle + tangent_angle;
    const float angle_b = base_angle - tangent_angle;

    const glm::vec2 point_a { pos.x + (radius * std::cos(angle_a)),
        pos.y + (radius * std::sin(angle_a)) };

    const glm::vec2 point_b { pos.x + (radius * std::cos(angle_b)),
        pos.y + (radius * std::sin(angle_b)) };
    return std::make_pair(point_a, point_b);
}

}

void Renderer::draw_shadow_map(simulation::Simulation &sim,
    std::vector<std::pair<glm::vec2, glm::vec2>> &shadow_segments,
    std::vector<entt::entity> &circles)
{
    BeginTextureMode(light_map_);
    ClearBackground(
        renderer::Colors::colors[renderer::Colors::COLOR_TRANSPARENT]);
    EndTextureMode();

    auto *registry = sim.get_registry();
    const auto &view
        = registry->view<simulation::PointLight, simulation::Transform>();

    for (const auto &[entity, light, transform] : view.each()) {
        if (light.cast_shadows) {
            BeginTextureMode(shadow_map_);
            ClearBackground(
                renderer::Colors::colors[renderer::Colors::COLOR_WHITE]);
            BeginMode2D(camera_);
            for (const auto &segment : shadow_segments) {
                auto quad = project_shadow(segment, transform.pos, 100.F);
                draw_shadow_quad(quad);
            }
            for (const auto &entity : circles) {
                const auto &circle = registry->get<simulation::Shape>(entity);
                const auto &c_transform
                    = registry->get<simulation::Transform>(entity);
                const float radius = circle.circle.size / 2.0F;
                auto segment = get_circle_segment(
                    transform.pos, c_transform.pos, radius);
                if (segment.has_value()) {
                    auto quad
                        = project_shadow(segment.value(), transform.pos, 100.F);
                    draw_shadow_quad(quad);
                }
            }
            EndMode2D();
            EndTextureMode();
        }

        BeginTextureMode(light_map_);
        BeginShaderMode(light_map_shader_);
        BeginBlendMode(BLEND_ADD_COLORS);
        BeginMode2D(camera_);
        draw_grid();

        SetShaderValue(light_map_shader_,
            GetShaderLocation(light_map_shader_, "light_intensity"),
            &light.intensity, SHADER_UNIFORM_FLOAT);
        SetShaderValue(light_map_shader_,
            GetShaderLocation(light_map_shader_, "light_radius"), &light.radius,
            SHADER_UNIFORM_FLOAT);
        glm::vec4 color
            = glm::vec4(light.color.r / 255.F, light.color.g / 255.F,
                light.color.b / 255.F, light.color.a / 255.F);
        SetShaderValue(light_map_shader_,
            GetShaderLocation(light_map_shader_, "light_color"), &color,
            SHADER_UNIFORM_VEC4);
        SetShaderValue(light_map_shader_,
            GetShaderLocation(light_map_shader_, "light_position"),
            &transform.pos, SHADER_UNIFORM_VEC2);
        glm::vec2 resolution(
            light_map_.texture.width, light_map_.texture.height);
        SetShaderValue(light_map_shader_,
            GetShaderLocation(light_map_shader_, "resolution"), &resolution,
            SHADER_UNIFORM_VEC2);
        SetShaderValueTexture(
            light_map_shader_, shadow_map_texture_loc_, shadow_map_.texture);

        EndMode2D();
        EndShaderMode();
        EndBlendMode();
        EndTextureMode();
    }
}

void Renderer::apply_bloom()
{
    float threshold = 0.1F;

    SetShaderValue(
        extract_shader_, threshold_loc_, &threshold, SHADER_UNIFORM_FLOAT);
    SetShaderValueTexture(extract_shader_,
        GetShaderLocation(extract_shader_, "texture0"), scene_target_.texture);

    BeginTextureMode(bright_target_);
    ClearBackground(BLACK);

    BeginShaderMode(extract_shader_);

    DrawTextureRec(scene_target_.texture,
        Rectangle {
            .x = 0.0F,
            .y = 0.0F,
            .width = static_cast<float>(scene_target_.texture.width),
            .height = -static_cast<float>(scene_target_.texture.height),
        },
        Vector2 { .x = 0.0F, .y = 0.0F }, WHITE);

    EndShaderMode();
    EndTextureMode();

    Vector2 texel_size {
        .x = 1.0F / static_cast<float>(blur_h_target_.texture.width),
        .y = 1.0F / static_cast<float>(blur_h_target_.texture.height),
    };

    Vector2 direction { .x = 1.0F, .y = 0.0F };

    BeginTextureMode(blur_h_target_);
    ClearBackground(BLACK);

    BeginShaderMode(blur_shader_);
    SetShaderValue(
        blur_shader_, texel_size_loc_, &texel_size, SHADER_UNIFORM_VEC2);
    SetShaderValue(
        blur_shader_, direction_loc_, &direction, SHADER_UNIFORM_VEC2);

    DrawTextureRec(bright_target_.texture,
        Rectangle {
            .x = 0.0F,
            .y = 0.0F,
            .width = static_cast<float>(bright_target_.texture.width),
            .height = -static_cast<float>(bright_target_.texture.height),
        },
        Vector2 { .x = 0.0F, .y = 0.0F }, WHITE);

    EndShaderMode();
    EndTextureMode();

    texel_size = {
        .x = 1.0F / static_cast<float>(blur_v_target_.texture.width),
        .y = 1.0F / static_cast<float>(blur_v_target_.texture.height),
    };

    direction = { .x = 0.0F, .y = 1.0F };

    BeginTextureMode(blur_v_target_);
    ClearBackground(BLACK);

    BeginShaderMode(blur_shader_);
    SetShaderValue(
        blur_shader_, texel_size_loc_, &texel_size, SHADER_UNIFORM_VEC2);

    SetShaderValue(
        blur_shader_, direction_loc_, &direction, SHADER_UNIFORM_VEC2);

    DrawTextureRec(blur_h_target_.texture,
        Rectangle {
            .x = 0.0F,
            .y = 0.0F,
            .width = static_cast<float>(bright_target_.texture.width),
            .height = -static_cast<float>(bright_target_.texture.height),
        },
        Vector2 { .x = 0.0F, .y = 0.0F }, WHITE);

    EndShaderMode();
    EndTextureMode();
}

void Renderer::draw_grid()
{
    const glm::vec2 grid_size { 30.F, 30.F };

    DrawRectangle(simulation::map_bounds_.min_x, simulation::map_bounds_.min_y,
        simulation::map_bounds_.max_x - simulation::map_bounds_.min_x,
        simulation::map_bounds_.max_y - simulation::map_bounds_.min_y,
        renderer::Colors::colors[renderer::Colors::COLOR_BACKGROUND]);

    const int grid_count_y
        = (simulation::map_bounds_.max_y - simulation::map_bounds_.min_y)
        / grid_size.y;
    const int grid_count_x
        = (simulation::map_bounds_.max_x - simulation::map_bounds_.min_x)
        / grid_size.x;

    for (int y = 0; y <= grid_count_y; ++y) {
        DrawLine(simulation::map_bounds_.min_x,
            (y * grid_size.y) + simulation::map_bounds_.min_y,
            simulation::map_bounds_.max_x,
            (y * grid_size.y) + simulation::map_bounds_.min_y,
            Colors::colors[Colors::COLOR_GRID]);
    }
    for (int x = 0; x <= grid_count_x; ++x) {
        DrawLine((x * grid_size.x) + simulation::map_bounds_.min_x,
            simulation::map_bounds_.min_y,
            (x * grid_size.x) + simulation::map_bounds_.min_x,
            simulation::map_bounds_.max_y, Colors::colors[Colors::COLOR_GRID]);
    }
}

void Renderer::update_camera(simulation::Simulation &sim)
{
    const float camera_zoom = 1.5F;
    const auto camera_look_ahead = 0.5F;
    const float max_camera_dist = 100.F;

    const auto &player_transform = *sim.get_player_transform();
    // const auto &player_tank = registry->get<simulation::Tank>(*tank);

    camera_.offset
        = { .x = GetRenderWidth() / 2.F, .y = GetRenderHeight() / 2.F };
    camera_.rotation = 0;
    camera_.zoom = camera_zoom * display_scale();

    glm::vec2 player_origin(player_transform.pos.x, player_transform.pos.y);

    const Vector2 mouse_screen = GetMousePosition();
    const Vector2 mouse_world_raylib
        = GetScreenToWorld2D(mouse_screen, camera_);
    const glm::vec2 mouse_world(mouse_world_raylib.x, mouse_world_raylib.y);

    const glm::vec2 mouse_delta = mouse_world - player_origin;
    const float distance = glm::length(mouse_delta);

    const glm::vec2 look_ahead = distance > max_camera_dist
        ? glm::normalize(mouse_delta) * max_camera_dist
        : mouse_delta;
    const float delta_time = GetFrameTime();
    const float smoothing = 5.0F;

    glm::vec2 camera_target = player_origin + (camera_look_ahead * look_ahead);
    if (distance < max_camera_dist)
        camera_target = player_origin;

    camera_target = glm::mix(glm::vec2(camera_.target.x, camera_.target.y),
        camera_target, smoothing * delta_time);

    camera_.target = { .x = camera_target.x, .y = camera_target.y };
}

void Renderer::draw_progress_bar(glm::vec2 pos, glm::vec2 size,
    Colors::type background, Colors::type foreground, float value,
    float max_value)
{
    DrawRectangle(pos.x, pos.y, size.x, size.y, Colors::colors[background]);
    DrawRectangle(pos.x + 2, pos.y + 1, (value / max_value) * (size.x - 2),
        size.y - 2, Colors::colors[foreground]);
}

void Renderer::draw_ui(simulation::Simulation &sim)
{
    BeginTextureMode(ui_target_);
    ClearBackground(Colors::colors[Colors::COLOR_BLACK]);
    BeginMode2D(Camera2D {
        .offset = { },
        .target = { },
        .rotation = 0,
        .zoom = display_scale(),
    });
    draw_player_status(sim);
    EndMode2D();
    EndTextureMode();
}

void Renderer::draw_player_status(simulation::Simulation &sim)
{
    (void)this;
    auto *registry = sim.get_registry();
    entt::entity player = sim.get_player();
    simulation::Health player_health
        = registry->get<simulation::Health>(player);
    simulation::Tank &player_tank = registry->get<simulation::Tank>(player);

    const uint32_t width = GetRenderWidth() / display_scale();
    const uint32_t height = GetRenderHeight() / display_scale();

    const float bar_width = width * 0.35F;
    const float bar_height = height * 0.05F;
    const float health_percentage = player_health.value / player_health.maximum;
    const float energy_percentage = player_tank.max_energy / player_tank.energy;

    DrawRectangle(width * 0.1F, height - bar_height - (bar_height * 1.25F),
        bar_width, bar_height, Colors::colors[Colors::COLOR_GRID]);

    DrawRectangle(width * 0.1F, height - bar_height - (bar_height * 1.15F),
        bar_width * health_percentage, bar_height * 0.85F,
        Colors::colors[Colors::COLOR_RED]);

    for (uint32_t i = 0; i < 10; ++i) {
        const float x = (width * 0.1F) + (bar_width * (i * 0.1F));
        const float y = height - bar_height - (bar_height * 1.25F);
        DrawLine(x, y, x, y + bar_height, Colors::colors[Colors::COLOR_GRID]);
    }

    DrawTriangle(
        {
            .x = width * 0.09F,
            .y = height - bar_height - (bar_height * 1.25F),
        },
        {
            .x = width * 0.09F,
            .y = height - (bar_height * 1.25F),
        },
        {
            .x = (width * 0.09F) + (bar_width * 0.15F),
            .y = height - bar_height - (bar_height * 1.25F),
        },
        Colors::colors[Colors::COLOR_BLACK]);

    DrawRectangle(width * 0.55F, height - bar_height - (bar_height * 1.25F),
        bar_width, bar_height, Colors::colors[Colors::COLOR_GRID]);

    DrawRectangle((width * 0.55F) + (bar_width * (1.0F - energy_percentage)),
        height - bar_height - (bar_height * 1.15F),
        bar_width * energy_percentage, bar_height * 0.85F,
        Colors::colors[Colors::COLOR_BLUE]);

    for (uint32_t i = 0; i < 10; ++i) {
        const float x = (width * 0.55F) + (bar_width * (i * 0.1F));
        const float y = height - bar_height - (bar_height * 1.25F);
        DrawLine(x, y, x, y + bar_height, Colors::colors[Colors::COLOR_GRID]);
    }

    DrawTriangle(
        {
            .x = (width * 0.56F) + bar_width,
            .y = height - bar_height - (bar_height * 1.25F),
        },
        {
            .x = (width * 0.56F) + bar_width - (bar_width * 0.15F),
            .y = height - bar_height - (bar_height * 1.25F),
        },
        {
            .x = (width * 0.56F) + bar_width,
            .y = height - (bar_height * 1.25F),
        },
        Colors::colors[Colors::COLOR_BLACK]);
}

} // namespace game::renderer
