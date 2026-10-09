cmake_minimum_required(VERSION 3.28)

project(game LANGUAGES CXX)

# ------------------------------------------------------------------------------
# Project options
# ------------------------------------------------------------------------------

add_library(game_base INTERFACE)
add_library(game::base ALIAS game_base)

if(MSVC)
    target_compile_options(game_base INTERFACE /W3 /WX)
else()
    target_compile_options(game_base INTERFACE -Wall -Wextra -Werror)
endif()

target_compile_features(game_base INTERFACE cxx_std_23)

# ------------------------------------------------------------------------------
# compile_commands.json
# ------------------------------------------------------------------------------

if(CMAKE_EXPORT_COMPILE_COMMANDS)
    file(
        CREATE_LINK
            "${CMAKE_BINARY_DIR}/compile_commands.json"
            "${CMAKE_SOURCE_DIR}/compile_commands.json"
        SYMBOLIC
        RESULT compile_commands_link_result
    )

    if(NOT compile_commands_link_result STREQUAL "0")
        message(
            WARNING
            "Could not create compile_commands.json symlink: "
            "${compile_commands_link_result}"
        )
    endif()
endif()

# ------------------------------------------------------------------------------
# Dependenies
# ------------------------------------------------------------------------------

include(FetchContent)

FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG 6.0
    GIT_SHALLOW TRUE
)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(USE_EXTERNAL_GLFW IF_POSSIBLE CACHE STRING "")

FetchContent_Declare(
    EnTT
    GIT_REPOSITORY https://github.com/skypjack/entt.git
    GIT_TAG v4.0.0
    GIT_SHALLOW TRUE
)
set(ENTT_BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(ENTT_BUILD_EXAMPLE OFF CACHE BOOL "" FORCE)
set(ENTT_BUILD_DOCS OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.17.0
    GIT_SHALLOW TRUE
)
set(SPDLOG_BUILD_EXAMPLE OFF CACHE BOOL "" FORCE)
set(SPDLOG_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(SPDLOG_BUILD_BENCH OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
	glm
	GIT_REPOSITORY https://github.com/g-truc/glm.git
	GIT_TAG 1.0.3
    GIT_SHALLOW TRUE
)
set(GLM_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(raylib EnTT spdlog glm)

include(CTest)

if(BUILD_TESTING)
    FetchContent_Declare(
        Catch2
        GIT_REPOSITORY https://github.com/catchorg/Catch2.git
        GIT_TAG v3.16.0
        GIT_SHALLOW TRUE
        FIND_PACKAGE_ARGS 3.16 CONFIG
    )

    FetchContent_MakeAvailable(Catch2)
    include(Catch)
endif()

# ------------------------------------------------------------------------------
# Project
# ------------------------------------------------------------------------------

set(CMAKE_CXX_SCAN_FOR_MODULES OFF)

add_subdirectory(src)

if(BUILD_TESTING)
    add_subdirectory(tests)
endif()
