@echo off
title Mixer - logcat NEXTGEN amplio (muchas lineas)
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
    echo No adb: %ADB%
    pause
    exit /b 1
)
echo AVISO: mucho ruido (NextGenEngine, plugins, JSON). Solo para depuracion profunda.
echo.
"%ADB%" devices
echo.
"%ADB%" logcat -v threadtime | findstr /I "NEXTGEN NextGenEngine"
