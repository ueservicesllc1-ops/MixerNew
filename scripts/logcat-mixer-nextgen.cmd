@echo off
title Mixer - logcat SOLO seek / diagnostico NEXTGEN
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
    echo No se encontro adb aqui: %ADB%
    echo Instala Android SDK Platform-Tools.
    pause
    exit /b 1
)
echo Solo lineas de seek nativo + scrub UI (sin spam de snapshot/posicion).
echo Patrones: NEXTGEN] seek* , first audio, clean block, partial read, NEXTGEN_UI] seek*
echo Conecta USB + depuracion. Ctrl+C para detener.
echo.
"%ADB%" devices
echo.
REM No uses "NextGenEngine" ni "NEXTGEN" suelto: inunda con getSnapshot y JSON.
"%ADB%" logcat -v threadtime | findstr /I /C:"NEXTGEN] seek" /C:"NEXTGEN] audio" /C:"NEXTGEN] first audible" /C:"NEXTGEN] partial read" /C:"NEXTGEN_UI] seek"
