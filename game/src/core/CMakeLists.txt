add_library(game_core app.cpp)
add_library(game::core ALIAS game_core)

target_include_directories(game_core PUBLIC include)
target_link_libraries(
    game_core
    PUBLIC game::platform game::simulation glm::glm spdlog::spdlog
    PRIVATE game::base game::renderer 
)
