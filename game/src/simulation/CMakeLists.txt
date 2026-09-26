add_library(game_simulation simulation.cpp)
add_library(game::simulation ALIAS game_simulation)

target_include_directories(game_simulation PUBLIC include)
target_link_libraries(game_simulation PUBLIC EnTT::EnTT PRIVATE game::base)
