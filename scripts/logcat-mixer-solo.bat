@echo off
chcp 65001 >nul
title Logcat SOLO proceso Mixer (menos ruido)
for /f %%i in ('adb shell pidof -s com.mixer.app 2^>nul') do set "PID=%%i"
if "%PID%"=="" (
  echo No hay proceso com.mixer.app. Abrí la app Mixer en la tablet y volvé a ejecutar este .bat
  pause
  exit /b 1
)
echo PID com.mixer.app: %PID%
echo Ctrl+C para salir.
adb logcat --pid=%PID% -v threadtime
