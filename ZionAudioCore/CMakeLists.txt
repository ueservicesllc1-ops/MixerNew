cmake_minimum_required(VERSION 3.15)
project(zion_audio_bridge)

# --- Configuración de cmake-js ---
include_directories(${CMAKE_JS_INC})
# Añadir ruta manual de node-addon-api
include_directories("E:/Mixer/node_modules/node-addon-api")

# --- Configuración de JUCE ---
# Buscamos JUCE en la carpeta de build si ya existe, o lo descargamos
if(NOT JUCE_PATH)
    set(JUCE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/build/_deps/juce-src" CACHE PATH "Path to JUCE")
endif()

if(EXISTS ${JUCE_PATH})
    add_subdirectory(${JUCE_PATH} ./JUCE)
else()
    # Si no existe, intentamos usar FetchContent para descargarlo automáticamente
    include(FetchContent)
    FetchContent_Declare(
        juce
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 8.0.0
    )
    FetchContent_MakeAvailable(juce)
endif()

# --- SoundTouch (time-stretch tono preservado, MusicBus) ---
set(SOUNDTOUCH_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/soundtouch")
if(NOT EXISTS "${SOUNDTOUCH_DIR}/include/SoundTouch.h")
    message(FATAL_ERROR "SoundTouch missing. From ZionAudioCore run:\n  git clone --depth 1 --branch 2.3.3 https://codeberg.org/soundtouch/soundtouch.git third_party/soundtouch")
endif()
set(SOUNDTOUCH_SOURCES
    ${SOUNDTOUCH_DIR}/source/SoundTouch/AAFilter.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/BPMDetect.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/cpu_detect_x86.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/FIFOSampleBuffer.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/FIRFilter.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/InterpolateCubic.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/InterpolateLinear.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/InterpolateShannon.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/mmx_optimized.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/PeakFinder.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/RateTransposer.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/SoundTouch.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/sse_optimized.cpp
    ${SOUNDTOUCH_DIR}/source/SoundTouch/TDStretch.cpp
)
add_library(soundtouch_zion STATIC ${SOUNDTOUCH_SOURCES})
target_include_directories(soundtouch_zion PUBLIC ${SOUNDTOUCH_DIR}/include)
target_compile_definitions(soundtouch_zion PRIVATE SOUNDTOUCH_FLOAT_SAMPLES)
target_compile_features(soundtouch_zion PUBLIC cxx_std_17)
if(MSVC)
    target_compile_options(soundtouch_zion PRIVATE /W0 /O2)
endif()

# --- Definición del Módulo Nativo ---
set(ZION_BRIDGE_SOURCES
    Bridge/ZionBridge.cpp
    Bridge/DesktopMixSession.cpp
    Core/ZionCore.cpp
    Engine/AudioEngine.cpp
    Transport/Transport.cpp
    Source/AudioSourceManager.cpp
)
if(DEFINED CMAKE_JS_SRC)
    list(APPEND ZION_BRIDGE_SOURCES ${CMAKE_JS_SRC})
endif()

add_library(${PROJECT_NAME} SHARED ${ZION_BRIDGE_SOURCES})

# --- Configuración de Salida ---
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# --- Inclusiones ---
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/Core
    ${CMAKE_CURRENT_SOURCE_DIR}/Engine
    ${CMAKE_CURRENT_SOURCE_DIR}/Transport
    ${CMAKE_CURRENT_SOURCE_DIR}/Source
)

# --- Linkeo ---
target_link_libraries(${PROJECT_NAME} PRIVATE
    soundtouch_zion
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_formats
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_core
    juce::juce_data_structures
    juce::juce_events
)

# Símbolos N-API (napi_*) — requerido para enlazar el .node con Node/Electron
if(DEFINED CMAKE_JS_LIB)
    target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB})
endif()

# --- Definiciones para Desktop ---
target_compile_definitions(${PROJECT_NAME} PRIVATE
    ZION_DESKTOP=1
    NAPI_VERSION=6
)
