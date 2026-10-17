// Single translation unit that compiles miniaudio.c implementation for the whole
// multitrack-native-engine shared library. Other .cpp files include miniaudio.h without
// defining MINIAUDIO_IMPLEMENTATION.

#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"
