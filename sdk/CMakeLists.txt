#1. CMake 最低版本号要求
cmake_minimum_required(VERSION 3.10)

#2. 项目定义
project(sdk LANGUAGES CXX)

# 设置SDK的名称
set(SDK_NAME ai_chat_sdk)

file(GLOB_RECURSE SRC CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/*.cc
)

file(GLOB_RECURSE HDR CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_SOURCE_DIR}/include/*.h
)

#3. 生成静态库
add_library(${SDK_NAME} STATIC ${SRC} ${HDR})

target_compile_definitions(${SDK_NAME} PUBLIC CPPHTTPLIB_OPENSSL_SUPPORT)

target_include_directories(${SDK_NAME}
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include
)

find_package(OpenSSL REQUIRED)

# 链接库
target_link_libraries(${SDK_NAME}
    PUBLIC
        jsoncpp
        fmt
        spdlog
        sqlite3
        OpenSSL::SSL
        OpenSSL::Crypto
)