add_library(game_renderer renderer.cpp)
add_library(game::renderer ALIAS game_renderer)

target_include_directories(game_renderer PUBLIC include)
target_link_libraries(
    game_renderer
    PUBLIC game::simulation
    PRIVATE game::base raylib
)
