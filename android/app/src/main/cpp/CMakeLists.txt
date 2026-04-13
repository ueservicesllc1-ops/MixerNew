cmake_minimum_required(VERSION 3.22.1)

project("mixer_native_engine")

file(GLOB SOUNDTOUCH_SRCS soundtouch/*.cpp)

add_library(
        multitrack-native-engine
        SHARED
        MiniaudioImplementation.cpp
        NextGenMultitrackEngine.cpp
        NextGenTempoLab.cpp
        ${SOUNDTOUCH_SRCS}
)

target_compile_options(multitrack-native-engine PRIVATE
        -O2
        -fexceptions
        -frtti
        -DSOUNDTOUCH_FLOAT_SAMPLES=1
        -DSOUNDTOUCH_DISABLE_X86_OPTIMIZATIONS=1
        -DST_NO_EXCEPTION_HANDLING=1
)

target_include_directories(multitrack-native-engine PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/soundtouch
)

target_link_libraries(
        multitrack-native-engine
        c++_shared
        log
        android
        OpenSLES
)

# Required for Android 15+ (16KB page size compatibility)
target_link_options(multitrack-native-engine PRIVATE "-Wl,-z,max-page-size=16384")
