/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   SpatialGrid.cpp                                    :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 15:08:38 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/08 22:38:07 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/SpatialGrid.hpp"

#include <raylib.h>
#include <spdlog/spdlog.h>

namespace game::simulation {

SpatialGrid::SpatialGrid(AABB bounds)
    : map_bounds_(bounds)
{
    float bounds_width = (bounds.max_x - bounds.min_x);
    float bounds_height = (bounds.max_y - bounds.min_y);

    chunk_count_x_ = static_cast<uint32_t>(std::ceil(std::sqrt(chunk_count_)));
    chunk_count_y_ = static_cast<uint32_t>(
        std::ceil(static_cast<float>(chunk_count_) / chunk_count_x_));
    chunk_width_ = bounds_width / chunk_count_x_;
    chunk_height_ = bounds_height / chunk_count_y_;

    for (uint32_t y = 0; y < chunk_count_y_; ++y) {
        for (uint32_t x = 0; x < chunk_count_x_; ++x) {
            AABB chunk_bound = {
                .min_x = bounds.min_x + (chunk_width_ * x),
                .min_y = bounds.min_y + (chunk_height_ * y),
                .max_x = bounds.min_x + (chunk_width_ * x) + chunk_width_,
                .max_y = bounds.min_y + (chunk_height_ * y) + chunk_height_,
            };

            chunks_[x + (y * chunk_count_x_)].bounds = chunk_bound;
        }
    }
}

void SpatialGrid::clear()
{
    for (auto &chunk : chunks_) {
        chunk.entities.clear();
    }
}

void SpatialGrid::insert(entt::entity entity, const AABB &box)
{
    if (!aabb_contains(map_bounds_, box)) {
        return;
    }

    const uint32_t chunk_start_x = std::min(
        static_cast<uint32_t>((box.min_x - map_bounds_.min_x) / chunk_width_),
        chunk_count_x_ - 1);

    const uint32_t chunk_start_y = std::min(
        static_cast<uint32_t>((box.min_y - map_bounds_.min_y) / chunk_height_),
        chunk_count_y_ - 1);

    const uint32_t chunk_end_x = std::min(
        static_cast<uint32_t>((box.max_x - map_bounds_.min_x) / chunk_width_),
        chunk_count_x_ - 1);

    const uint32_t chunk_end_y = std::min(
        static_cast<uint32_t>((box.max_y - map_bounds_.min_y) / chunk_height_),
        chunk_count_y_ - 1);

    for (uint32_t y = chunk_start_y; y <= chunk_end_y; ++y) {
        for (uint32_t x = chunk_start_x; x <= chunk_end_x; ++x) {
            const uint32_t index = x + (y * chunk_count_x_);
            if (index >= chunk_count_)
                return;
            if (aabb_intersects(chunks_[index].bounds, box)) {
                chunks_[index].entities.emplace_back(entity, box);
            }
        }
    }
}

void SpatialGrid::query(
    const AABB &area, std::vector<entt::entity> &result) const
{
    if (!aabb_intersects(map_bounds_, area))
        return;

    const uint32_t chunk_start_x = std::min(
        static_cast<uint32_t>((area.min_x - map_bounds_.min_x) / chunk_width_),
        chunk_count_x_ - 1);

    const uint32_t chunk_start_y = std::min(
        static_cast<uint32_t>((area.min_y - map_bounds_.min_y) / chunk_height_),
        chunk_count_y_ - 1);

    const uint32_t chunk_end_x = std::min(
        static_cast<uint32_t>((area.max_x - map_bounds_.min_x) / chunk_width_),
        chunk_count_x_ - 1);

    const uint32_t chunk_end_y = std::min(
        static_cast<uint32_t>((area.max_y - map_bounds_.min_y) / chunk_height_),
        chunk_count_y_ - 1);

    for (uint32_t y = chunk_start_y; y <= chunk_end_y; ++y) {
        for (uint32_t x = chunk_start_x; x <= chunk_end_x; ++x) {
            const uint32_t index = x + (y * chunk_count_x_);

            if (index >= chunk_count_)
                return;

            if (aabb_intersects(chunks_[index].bounds, area)) {
                for (const auto &entity : chunks_[index].entities) {
                    result.push_back(entity.first);
                }
            }
        }
    }
}

void SpatialGrid::render() const
{
    for (uint32_t i = 0; i < chunk_count_; ++i) {
        const AABB &bounds_chunks = chunks_[i].bounds;
        DrawRectangleLines(bounds_chunks.min_x, bounds_chunks.min_y,
            (bounds_chunks.max_x - bounds_chunks.min_x),
            (bounds_chunks.max_x - bounds_chunks.min_x),
            { .r = 255, .g = 0, .b = 0, .a = 255 });
        for (const auto &entity : chunks_[i].entities) {
            const AABB &bounds_entity = entity.second;
            DrawRectangleLines(bounds_entity.min_x, bounds_entity.min_y,
                (bounds_entity.max_x - bounds_entity.min_x),
                (bounds_entity.max_x - bounds_entity.min_x),
                { .r = 0, .g = 255, .b = 0, .a = 255 });
        }
    }
}
}
