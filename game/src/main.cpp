/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   main.cpp                                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: mle-flem <mle-flem@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 04:05:54 by mle-flem          #+#    #+#             */
/*   Updated: 2026/09/20 04:31:01 by mle-flem         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

#include <memory>

#include "game/app.hpp"

namespace {

std::unique_ptr<game::core::App> app;

#ifdef __EMSCRIPTEN__
void iterate(void *state)
{
    auto &application = *static_cast<game::core::App *>(state);
    if (game::core::App::should_quit()) {
        emscripten_cancel_main_loop();
        app.reset();
        return;
    }
    application.iterate();
}
#endif

} // namespace

int main()
{
    app = std::make_unique<game::core::App>();
    if (!app->initialize()) {
        app.reset();
        return 1;
    }

#ifdef __EMSCRIPTEN__
    emscripten_set_main_loop_arg(iterate, app.get(), 0, true);
#else
    while (!game::core::App::should_quit())
        app->iterate();
    app.reset();
#endif

    return 0;
}

#ifdef __EMSCRIPTEN__
extern "C" EMSCRIPTEN_KEEPALIVE void game_shutdown()
{
    emscripten_cancel_main_loop();
    app.reset();
}
#endif
