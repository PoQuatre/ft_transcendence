add_library(game_network network_client.cpp)
add_library(game::network ALIAS game_network)

target_include_directories(game_network PUBLIC include)
target_link_libraries(game_network PUBLIC game::protocol PRIVATE game::base)
