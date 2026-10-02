add_subdirectory(simulation)
add_subdirectory(platform)
add_subdirectory(renderer)
add_subdirectory(core)

add_executable(game main.cpp)

target_link_libraries(game PUBLIC glm::glm PRIVATE game::base game::core)

if(EMSCRIPTEN)
    set_target_properties(game PROPERTIES SUFFIX ".mjs")
    target_link_options(
        game
        PRIVATE
            -sASYNCIFY
            -sENVIRONMENT=web
            -sEXPORTED_RUNTIME_METHODS=requestFullscreen
            -sUSE_GLFW=3
            -sALLOW_MEMORY_GROWTH=1
    )
endif()
