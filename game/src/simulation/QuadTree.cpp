/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   QuadTree.cpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 15:08:38 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/04 16:55:34 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "game/QuadTree.hpp"

#include <raylib.h>

namespace game::simulation {

Quadtree::Quadtree(AABB bounds, int max_entities, int max_depth)
    : max_entities_(max_entities)
    , max_depth_(max_depth)
{
    root_ = std::make_unique<Node>();
    root_->bounds = bounds;
}

void Quadtree::clear()
{
    root_->entities.clear();

    for (auto &child : root_->children)
        child.reset();
}

void Quadtree::insert(entt::entity entity, const AABB &box)
{
    insert(root_.get(), entity, box, 0);
}

void Quadtree::query(const AABB &area, std::vector<entt::entity> &result) const
{
    query(root_.get(), area, result);
}

void Quadtree::insert(
    Node *node, entt::entity entity, const AABB &box, size_t depth)
{
    if (node->children[0] != nullptr) {
        for (int i = 0; i < 4; ++i) {
            if (aabb_contains(node->children[i]->bounds, box)) {
                insert(node->children[i].get(), entity, box, depth + 1);
                return;
            }
        }
    }

    node->entities.emplace_back(entity, box);

    if (node->children[0] == nullptr && node->entities.size() > max_entities_
        && depth < max_depth_) {

        split(node);
        auto old_entities = std::move(node->entities);
        node->entities.clear();

        for (const auto e : old_entities) {
            bool inserted = false;
            for (int i = 0; i < 4; ++i) {
                if (aabb_contains(node->children[i]->bounds, e.second)) {
                    node->children[i]->entities.push_back(e);
                    inserted = true;
                    break;
                }
            }
            if (!inserted)
                node->entities.push_back(e);
        }
    }
}

void Quadtree::split(Node *node)
{
    (void)this;
    const float mid_x = (node->bounds.min_x + node->bounds.max_x) * 0.5F;
    const float mid_y = (node->bounds.min_y + node->bounds.max_y) * 0.5F;
    const float min_x = node->bounds.min_x;
    const float min_y = node->bounds.min_y;
    const float max_x = node->bounds.max_x;
    const float max_y = node->bounds.max_y;

    // Top-left
    node->children[0] = std::make_unique<Node>();
    node->children[0]->bounds
        = { .min_x = min_x, .min_y = min_y, .max_x = mid_x, .max_y = mid_y };

    // Top-right
    node->children[1] = std::make_unique<Node>();
    node->children[1]->bounds
        = { .min_x = mid_x, .min_y = min_y, .max_x = max_x, .max_y = mid_y };

    // Bottom-left
    node->children[2] = std::make_unique<Node>();
    node->children[2]->bounds
        = { .min_x = min_x, .min_y = mid_y, .max_x = mid_x, .max_y = max_y };

    // Bottom-right
    node->children[3] = std::make_unique<Node>();
    node->children[3]->bounds
        = { .min_x = mid_x, .min_y = mid_y, .max_x = max_x, .max_y = max_y };
}

void Quadtree::query(
    const Node *node, const AABB &area, std::vector<entt::entity> &result) const
{
    if (!aabb_intersects(node->bounds, area))
        return;

    for (const auto &entity : node->entities)
        result.push_back(entity.first);

    if (node->children[0] != nullptr) {
        for (const auto &child : node->children)
            query(child.get(), area, result);
    }
}

void Quadtree::render() const { render(root_.get(), 0); }

void Quadtree::render(Node *node, int depth) const
{
    if (node->children[0] != nullptr) {
        for (int i = 0; i < 4; ++i) {
            render(node->children[i].get(), depth + 1);
        }
        return;
    }

    auto dim = aabb_dimensions(node->bounds);

    DrawRectangleLines(node->bounds.min_x, node->bounds.max_y, dim.x, dim.y,
        { .r = 255,
            .g = static_cast<unsigned char>(30 * depth),
            .b = static_cast<unsigned char>(30 * depth),
            .a = 255 });
    std::string count = std::to_string(node->entities.size());
    DrawText(count.c_str(), node->bounds.min_x, node->bounds.min_y, 32,
        { .r = 255,
            .g = static_cast<unsigned char>(30 * depth),
            .b = static_cast<unsigned char>(30 * depth),
            .a = 255 });
    for (const auto &entity : node->entities) {

        auto pos = aabb_position(entity.second);
        auto dim = aabb_dimensions(entity.second);
        dim.x /= 2;
        dim.y /= 2;

        DrawRectangleLines(pos.x, pos.y, dim.x, dim.y,
            { .r = 0,
                .g = 255,
                .b = static_cast<unsigned char>(30 * depth),
                .a = 255 });
    }
}

}
