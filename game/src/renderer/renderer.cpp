/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   renderer.cpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:41:30 by mle-flem          #+#    #+#             */
/*   Updated: 2026/10/13 22:03:07 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/renderer.hpp"

#include <nanosvg.h>
#include <nanosvgrast.h>
#include <raylib.h>
#include <spdlog/spdlog.h>

#include <glm/geometric.hpp>

#include "game/simulation.hpp"

namespace {

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

void Renderer::init()
{
    size_t i = 0;
    for (const auto &path : simulation::TankType::paths) {
        const std::string path_copy(path);
        SPDLOG_INFO("loading texture {}", path_copy);
        Image image = LoadImageSVG(path_copy.c_str(), 0, 0);
        ImageResize(&image, 0.5 * image.width, 0.5 * image.height);
        tank_textures_[i] = LoadTextureFromImage(image);
        UnloadImage(image);
        ++i;
    }

    i = 0;
    for (const auto &path : simulation::ProjectileType::paths) {
        const std::string path_copy(path);
        SPDLOG_INFO("loading texture {}", path_copy);
        Image image = LoadImageSVG(path_copy.c_str(), 0, 0);
        ImageResize(&image, 0.5 * image.width, 0.5 * image.height);
        projectile_textures_[i] = LoadTextureFromImage(image);
        UnloadImage(image);
        ++i;
    }
    font_ = LoadFont(
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/space_grotesk.ttf");
    Image crosshair_image = LoadImageSVG(
        CMAKE_SOURCE_DIR "/src/renderer/assets/textures/crosshair.svg", 0, 0);
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

    threshold_loc_ = GetShaderLocation(extract_shader_, "threshold");
    texel_size_loc_ = GetShaderLocation(blur_shader_, "texelSize");
    direction_loc_ = GetShaderLocation(blur_shader_, "direction");
    bloom_texture_loc_ = GetShaderLocation(composite_shader_, "bloomTexture");
    intensity_loc_ = GetShaderLocation(composite_shader_, "bloomIntensity");
}

Renderer::~Renderer()
{
    for (size_t i = 0; i < simulation::TankType::paths.size(); ++i) {
        UnloadTexture(tank_textures_[i]);
    }

    for (size_t i = 0; i < simulation::ProjectileType::paths.size(); ++i) {
        UnloadTexture(tank_textures_[i]);
    }
    UnloadFont(font_);
    UnloadTexture(crosshair_);

    UnloadRenderTexture(scene_target_);
    UnloadRenderTexture(bright_target_);
    UnloadRenderTexture(blur_v_target_);
    UnloadRenderTexture(blur_h_target_);

    UnloadShader(extract_shader_);
    UnloadShader(blur_shader_);
    UnloadShader(composite_shader_);
}

void Renderer::update_render_textures()
{
    if (render_width_ != GetRenderWidth()
        || render_height_ != GetRenderHeight()) {
        render_width_ = GetRenderWidth();
        render_height_ = GetRenderHeight();

        UnloadRenderTexture(scene_target_);
        UnloadRenderTexture(bright_target_);
        UnloadRenderTexture(blur_v_target_);
        UnloadRenderTexture(blur_h_target_);

        scene_target_ = LoadRenderTexture(render_width_, render_height_);
        bright_target_ = LoadRenderTexture(render_width_, render_height_);
        blur_v_target_ = LoadRenderTexture(render_width_, render_height_);
        blur_h_target_ = LoadRenderTexture(render_width_, render_height_);
    }
}

void Renderer::draw(simulation::Simulation &sim)
{
    update_render_textures();

    render_scene(sim);

    apply_bloom();

    float bloom_intensity = 3.2F;

    BeginDrawing();
    ClearBackground(Colors::colors[Colors::COLOR_BACKGROUND]);

    BeginShaderMode(composite_shader_);
    SetShaderValue(composite_shader_, intensity_loc_, &bloom_intensity,
        SHADER_UNIFORM_FLOAT);
    SetShaderValueTexture(
        composite_shader_, bloom_texture_loc_, blur_v_target_.texture);

    DrawTextureRec(scene_target_.texture,
        Rectangle {
            .x = 0.0F,
            .y = 0.0F,
            .width = static_cast<float>(scene_target_.texture.width),
            .height = -static_cast<float>(scene_target_.texture.height),
        },
        Vector2 { .x = 0.0F, .y = 0.0F }, WHITE);

    EndShaderMode();

    DrawFPS(8, 8);

    EndDrawing();
}

void Renderer::render_scene(simulation::Simulation &sim)
{
    update_camera(sim);
    auto *registry = sim.get_registry();

    BeginTextureMode(scene_target_);
    ClearBackground(Colors::colors[Colors::COLOR_BACKGROUND]);
    BeginMode2D(camera_);

    draw_grid();

    for (const auto entity : registry->view<simulation::Tank, simulation::Color,
             simulation::Transform>()) {

        const auto &transform = registry->get<simulation::Transform>(entity);
        const auto &tank = registry->get<simulation::Tank>(entity);
        const auto &direction = tank.dir;

        float rot = (atan2(direction.y, direction.x) + M_PI) * RAD2DEG;
        Texture texture = tank_textures_[tank.type];
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

        DrawTextEx(font_, tank.name.c_str(),
            {
                .x = transform.pos.x - ((tank.name.size() / 2.F) + 12),
                .y = transform.pos.y + (texture.height - 12),
            },
            24, 2, Color { .r = 0xFF, .g = 0xFF, .b = 0xFF, .a = 0xFF });
    }

    for (const auto entity :
        registry->view<simulation::Color, simulation::Transform,
            simulation::ShapeType>(entt::exclude<simulation::Projectile>)) {
        const auto &transform = registry->get<simulation::Transform>(entity);
        const auto &color = registry->get<simulation::Color>(entity);

        const auto &shape_type = registry->get<simulation::ShapeType>(entity);
        const auto &shape = registry->get<simulation::Shape>(entity);

        const auto *res = registry->try_get<simulation::Ressource>(entity);

        switch (shape_type) {
        case simulation::ShapeType::SHAPE_RECT:
            DrawRectangleLines(transform.pos.x, transform.pos.y,
                shape.rect.width, shape.rect.height,
                Color {
                    .r = color.r,
                    .g = color.g,
                    .b = color.b,
                    .a = color.a,
                });
            if (res != nullptr && res->health != res->max_health) {
                Renderer::draw_progress_bar(
                    { transform.pos.x,
                        transform.pos.y + shape.rect.height + 4 },
                    { 20, 10 }, { .r = 255, .g = 255, .b = 255, .a = 255 },
                    { .r = 0, .g = 0, .b = 0, .a = 255 }, res->health,
                    res->max_health);
            }
            break;
        case simulation::ShapeType::SHAPE_CIRCLE:
            DrawCircleLinesV(
                Vector2 {
                    .x = transform.pos.x + (shape.circle.size / 2.0F),
                    .y = transform.pos.y + (shape.circle.size / 2.0F),
                },
                shape.circle.size / 2.0F,
                Color {
                    .r = color.r,
                    .g = color.g,
                    .b = color.b,
                    .a = color.a,
                });
            if (res != nullptr && res->health != res->max_health) {
                Renderer::draw_progress_bar(
                    { transform.pos.x,
                        transform.pos.y + shape.circle.size + 4 },
                    { 20, 10 }, { .r = 255, .g = 255, .b = 255, .a = 255 },
                    { .r = 0, .g = 0, .b = 0, .a = 255 }, res->health,
                    res->max_health);
            }
            break;
        default:
            break;
        }
    }

    for (const auto entity : registry->view<simulation::Color,
             simulation::Transform, simulation::Projectile>()) {
        const auto &transform = registry->get<simulation::Transform>(entity);
        // const auto &color = registry->get<simulation::Color>(entity);
        const auto &proj = registry->get<simulation::Projectile>(entity);

        float rot = (transform.rotation + M_PI) * RAD2DEG;
        Texture texture = projectile_textures_[proj.type];
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

    const Vector2 mouse_screen = GetMousePosition();
    const Vector2 mouse_world_raylib
        = GetScreenToWorld2D(mouse_screen, camera_);
    DrawTexture(crosshair_, mouse_world_raylib.x - (crosshair_.width / 2.F),
        mouse_world_raylib.y - (crosshair_.height / 2.F), WHITE);

    EndMode2D();
    EndTextureMode();
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
    const glm::vec2 grid_size { 80.F, 80.F };

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
    auto *registry = sim.get_registry();
    const float camera_zoom = 1.5F;
    const float camera_look_ahead = 0.5F;
    const float max_camera_dist = 100.F;

    const auto tank = registry->view<simulation::Tank>().begin();
    const auto &player_transform = registry->get<simulation::Transform>(*tank);
    const auto &player_tank = registry->get<simulation::Tank>(*tank);

    camera_.offset
        = { .x = GetRenderWidth() / 2.F, .y = GetRenderHeight() / 2.F };
    camera_.rotation = 0;
    camera_.zoom = camera_zoom;

    const Vector2 mouse_screen = GetMousePosition();
    const Vector2 mouse_world_raylib
        = GetScreenToWorld2D(mouse_screen, camera_);
    const glm::vec2 mouse_world(mouse_world_raylib.x, mouse_world_raylib.y);

    glm::vec2 player_origin(player_transform.pos.x
            + simulation::TankType::origins[player_tank.type].x,
        player_transform.pos.y
            + simulation::TankType::origins[player_tank.type].y);

    // Direction from the player's origin toward the cursor.
    const glm::vec2 mouse_delta = mouse_world - player_origin;
    const float distance = glm::length(mouse_delta);

    // Clamp the look-ahead distance.
    const glm::vec2 look_ahead = distance > max_camera_dist
        ? glm::normalize(mouse_delta) * max_camera_dist
        : mouse_delta;

    const float delta_time = GetFrameTime();
    const float smoothing = 5.0F;

    // Move the target halfway toward the clamped mouse position.
    glm::vec2 camera_target = player_origin + (camera_look_ahead * look_ahead);

    camera_target = glm::mix(glm::vec2(camera_.target.x, camera_.target.y),
        camera_target, smoothing * delta_time);

    camera_.target = { .x = camera_target.x, .y = camera_target.y };
}

void Renderer::draw_progress_bar(glm::vec2 pos, glm::vec2 size,
    simulation::Color background, simulation::Color foreground, float value,
    float max_value)
{
    DrawRectangle(pos.x, pos.y, size.x, size.y,
        Color {
            .r = background.r,
            .g = background.g,
            .b = background.b,
            .a = background.a,
        });
    DrawRectangle(pos.x + 2, pos.y + 1, (value / max_value) * (size.x - 2),
        size.y - 2,
        Color {
            .r = foreground.r,
            .g = foreground.g,
            .b = foreground.b,
            .a = foreground.a,
        });
}

} // namespace game::renderer
