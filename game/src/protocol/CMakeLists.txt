add_library(game_protocol protocol.cpp)
add_library(game::protocol ALIAS game_protocol)

target_include_directories(game_protocol PUBLIC include)
target_link_libraries(
    game_protocol
    PRIVATE game::base game::protocol::schemas flatbuffers
)
