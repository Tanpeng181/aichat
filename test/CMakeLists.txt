cmake_minimum_required(VERSION 3.10)
project(TestProject)

add_subdirectory(../sdk sdk_build)

find_package(GTest REQUIRED)

add_executable(test testLLM.cc)
target_link_libraries(test PRIVATE ai_chat_sdk GTest::gtest pthread)