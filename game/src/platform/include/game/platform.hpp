/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   platform.hpp                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 21:50:38 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/20 01:06:50 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#pragma once

namespace game::platform {

class Platform {
public:
    Platform() = default;
    Platform(const Platform &) = delete;
    Platform &operator=(const Platform &) = delete;
    ~Platform();

    bool initialize();
    [[nodiscard]] static bool should_quit();
    double delta_seconds();
    [[nodiscard]] static int width();
    [[nodiscard]] static int height();

private:
    double last_time_ { };
    bool initialized_ { };
};

} // namespace game::platform
