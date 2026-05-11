# Zion Audio Core — WASM (ZionEngine.cpp + embind)
# Requires: emsdk activated (emsdk_env) so EMSDK is set; Ninja optional.

param(
    [string]$CMake = "cmake"
)

$ErrorActionPreference = "Stop"
$zionRoot = $PSScriptRoot
$wasmSrc = Join-Path $zionRoot "wasm"
$buildDir = Join-Path $wasmSrc "build"
$mixerRoot = Split-Path $zionRoot -Parent
$outJs = Join-Path $mixerRoot "src\wasm\zion_audio_core_wasm.js"
$outWasm = Join-Path $mixerRoot "src\wasm\zion_audio_core_wasm.wasm"
$pubJs = Join-Path $mixerRoot "public\wasm\zion_audio_core_wasm.js"
$pubWasm = Join-Path $mixerRoot "public\wasm\zion_audio_core_wasm.wasm"

Write-Host "--- Zion Audio Core: Building WASM (ZionEngine.cpp) ---" -ForegroundColor Cyan

if (-not $env:EMSDK) {
    Write-Host "ERROR: EMSDK not set. Run emsdk_env.ps1 from your emsdk install." -ForegroundColor Red
    exit 1
}

$toolchain = Join-Path $env:EMSDK "upstream\emscripten\cmake\Modules\Platform\Emscripten.cmake"
if (-not (Test-Path $toolchain)) {
    Write-Host "ERROR: Emscripten toolchain not found: $toolchain" -ForegroundColor Red
    exit 1
}

Push-Location $wasmSrc
try {
    & $CMake -B $buildDir -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE="$toolchain"
    & $CMake --build $buildDir --parallel
}
finally {
    Pop-Location
}

$builtJs = Join-Path $buildDir "zion_audio_core_wasm.js"
$builtWasm = Join-Path $buildDir "zion_audio_core_wasm.wasm"
if (-not (Test-Path $builtJs)) {
    Write-Host "ERROR: Build did not produce $builtJs" -ForegroundColor Red
    exit 1
}

Copy-Item -Force $builtJs $outJs
if (Test-Path $builtWasm) { Copy-Item -Force $builtWasm $outWasm }
if (Test-Path (Split-Path $pubJs -Parent)) {
    Copy-Item -Force $builtJs $pubJs -ErrorAction SilentlyContinue
    if (Test-Path $builtWasm) { Copy-Item -Force $builtWasm $pubWasm -ErrorAction SilentlyContinue }
}

Write-Host "--- Copied to src/wasm (and public/wasm if present) ---" -ForegroundColor Green
