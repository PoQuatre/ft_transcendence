add_executable(simulation_test simulation_test.cpp)

target_link_libraries(
    simulation_test
    PRIVATE game::base Catch2::Catch2WithMain game::simulation
)

catch_discover_tests(simulation_test)
