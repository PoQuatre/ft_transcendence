/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   QuadTree.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: uanglade </var/spool/mail/uanglade>        +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/04 14:27:52 by uanglade          #+#    #+#             */
/*   Updated: 2026/10/08 02:11:38 by uanglade         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

#include <entt/entt.hpp>

#include "components.hpp"

namespace game::simulation {

inline bool aabb_intersects(const AABB &a, const AABB &b)
{
    return a.min_x <= b.max_x && a.max_x >= b.min_x && a.min_y <= b.max_y
        && a.max_y >= b.min_y;
}

inline bool aabb_contains(const AABB &outer, const AABB &inner)
{
    return inner.min_x >= outer.min_x && inner.max_x <= outer.max_x
        && inner.min_y >= outer.min_y && inner.max_y <= outer.max_y;
}

inline glm::vec2 aabb_position(const AABB box)
{
    return { (box.max_x + box.min_x) / 2, (box.max_y + box.min_y) / 2 };
}

inline glm::vec2 aabb_dimensions(const AABB box)
{
    return { box.max_x - box.min_x, box.max_y - box.min_y };
}

class Quadtree {
public:
    struct Node {
        AABB bounds;
        std::vector<std::pair<entt::entity, AABB>> entities;
        std::array<std::unique_ptr<Node>, 4> children;
    };

    Quadtree() = default;
    Quadtree(AABB bounds, int max_entities = 2, int max_depth = 32);

    void clear();
    void insert(entt::entity entity, const AABB &box);
    void query(const AABB &area, std::vector<entt::entity> &result) const;
    void render() const;

private:
    std::unique_ptr<Node> root_;

    size_t max_entities_ = 8;
    size_t max_depth_ = 8;

    void insert(Node *node, entt::entity entity, const AABB &box, size_t depth);
    void split(Node *node, size_t depth);
    void query(const Node *node, const AABB &area,
        std::vector<entt::entity> &result) const;
    void render(Node *node, int depth) const;
};

}
