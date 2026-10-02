add_library(game_platform raylib_platform.cpp)
add_library(game::platform ALIAS game_platform)

target_include_directories(game_platform PUBLIC include)
target_link_libraries(game_platform PUBLIC glm::glm PRIVATE game::base raylib spdlog::spdlog)
