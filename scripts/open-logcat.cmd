@echo off
title Mixer - adb logcat
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
    echo No se encontro adb.
    echo Ruta esperada: %ADB%
    echo Instala "Android SDK Platform-Tools" o ajusta esta variable en el script.
    pause
    exit /b 1
)
echo Conectando logcat con: %ADB%
echo.
"%ADB%" logcat
