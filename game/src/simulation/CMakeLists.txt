add_library(game_simulation simulation.cpp)
add_library(game::simulation ALIAS game_simulation)

target_include_directories(game_simulation PUBLIC include)
target_link_libraries(game_simulation PUBLIC EnTT::EnTT glm::glm game::platform box2d::box2d PRIVATE game::base spdlog::spdlog game::platform raylib)
