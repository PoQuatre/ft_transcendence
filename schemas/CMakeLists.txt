flatbuffers_generate_headers(
    TARGET game_protocol_schemas
    SCHEMAS common.fbs event.fbs packet_ids.fbs state.fbs sync.fbs
    FLAGS --scoped-enums --cpp-std c++17
    INCLUDE_PREFIX "game/protocol/schemas"
)
add_dependencies(game_protocol_schemas GENERATE_game_protocol_schemas)
add_library(game::protocol::schemas ALIAS game_protocol_schemas)
