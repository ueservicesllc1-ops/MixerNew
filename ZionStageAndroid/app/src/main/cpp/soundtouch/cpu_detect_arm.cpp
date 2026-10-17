// Non-x86 (ARM) stub for CPU feature detection.
// On ARM none of the x86 MMX/SSE extensions exist; return 0.
#include "cpu_detect.h"

static uint _dwDisabledISA = 0;

uint detectCPUextensions(void) {
    return 0 & ~_dwDisabledISA;
}

void disableExtensions(uint disableMask) {
    _dwDisabledISA = disableMask;
}
