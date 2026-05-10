cmake_minimum_required(VERSION 3.15)

project(ZionAudioCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- JUCE Setup ---
include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        origin/master
)
FetchContent_MakeAvailable(JUCE)

# --- ZionAudioCore Library ---
add_library(ZionAudioCore STATIC)

target_sources(ZionAudioCore
    PRIVATE
        Core/ZionCore.cpp
        Core/ZionBindings.cpp
        Engine/AudioEngine.cpp
        Transport/Transport.cpp
        Source/AudioSourceManager.cpp
    PUBLIC
        Core/ZionCore.h
        Engine/AudioEngine.h
        Transport/Transport.h
        Source/AudioSourceManager.h
)

target_include_directories(ZionAudioCore
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
)

# --- JUCE Modules ---
target_link_libraries(ZionAudioCore
    PUBLIC
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_audio_formats
        juce::juce_audio_devices
        juce::juce_audio_basics
        juce::juce_core
    PRIVATE
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# --- WebAssembly / Emscripten Configuration ---
if(EMSCRIPTEN)
    # Enable Embind
    target_compile_options(ZionAudioCore PUBLIC "--bind")
    target_link_options(ZionAudioCore PUBLIC "--bind")

    # Important Emscripten flags for Audio
    target_link_options(ZionAudioCore PUBLIC 
        "-s WASM=1"
        "-s ALLOW_MEMORY_GROWTH=1"
        "-s EXPORT_ES6=1"
        "-s MODULARIZE=1"
        "-s EXPORT_NAME='ZionAudioCoreModule'"
        "-s USE_PTHREADS=1" # Recommended for real-time audio
        "-s PTHREAD_POOL_SIZE=2"
    )

    # Output WASM target
    add_executable(zion_audio_core_wasm main.cpp)
    target_link_libraries(zion_audio_core_wasm PRIVATE ZionAudioCore)
    set_target_properties(zion_audio_core_wasm PROPERTIES SUFFIX ".js")
else()
    # Console App for Testing (Native)
    add_executable(ZionAudioConsole main.cpp)
    target_link_libraries(ZionAudioConsole PRIVATE ZionAudioCore)
endif()
