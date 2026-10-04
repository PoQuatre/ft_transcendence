add_library(game_simulation simulation.cpp collision.cpp QuadTree.cpp)
add_library(game::simulation ALIAS game_simulation)

target_include_directories(game_simulation PUBLIC include)
target_link_libraries(game_simulation PUBLIC EnTT::EnTT glm::glm game::platform PRIVATE game::base spdlog::spdlog game::platform raylib)
