# ZionAudioCore WebAssembly Build Script
# Requires Emscripten (emsdk) installed and in PATH

$cmakePath = "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"

Write-Host "--- Zion Audio Core: Building WASM ---" -ForegroundColor Cyan

# Create and enter build directory
if (!(Test-Path "build_wasm")) { New-Item -ItemType Directory -Path "build_wasm" }
Set-Location "build_wasm"

# Run CMake with Emscripten Toolchain
# Assuming EMSCRIPTEN environment variable is set
& $cmakePath .. -DCMAKE_TOOLCHAIN_FILE="$env:EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake" `
               -DCMAKE_BUILD_TYPE=Release `
               -G "Ninja" # Or "Unix Makefiles"

# Build
& $cmakePath --build .

Write-Host "--- Build Complete: build_wasm/zion_audio_core_wasm.js ---" -ForegroundColor Green
