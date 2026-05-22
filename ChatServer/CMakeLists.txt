cmake_minimum_required(VERSION 3.10)

project(ChatServer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_subdirectory(../sdk sdk_build)

find_package(Threads REQUIRED)
find_package(gflags REQUIRED)

file(GLOB CHATSERVER_SOURCES CONFIGURE_DEPENDS
	${CMAKE_CURRENT_SOURCE_DIR}/ChatServer.cc
	${CMAKE_CURRENT_SOURCE_DIR}/main.cc
)

add_executable(ChatServer ${CHATSERVER_SOURCES})

target_include_directories(ChatServer PRIVATE
	${CMAKE_CURRENT_SOURCE_DIR}
)

if(TARGET gflags::gflags)
	set(GFLAGS_TARGET gflags::gflags)
elseif(TARGET gflags)
	set(GFLAGS_TARGET gflags)
else()
	set(GFLAGS_TARGET gflags)
endif()

target_link_libraries(ChatServer PRIVATE
	ai_chat_sdk
	${GFLAGS_TARGET}
	Threads::Threads
)

set_target_properties(ChatServer PROPERTIES
	RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}
)
