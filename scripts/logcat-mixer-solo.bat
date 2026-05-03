@echo off
chcp 65001 >nul
title Logcat SOLO proceso Mixer (menos ruido)
for /f %%i in ('adb shell pidof -s com.zionstagelive.app 2^>nul') do set "PID=%%i"
if "%PID%"=="" (
  echo No hay proceso com.zionstagelive.app. Abrí la app Mixer en la tablet y volvé a ejecutar este .bat
  pause
  exit /b 1
)
echo PID com.zionstagelive.app: %PID%
echo Ctrl+C para salir.
adb logcat --pid=%PID% -v threadtime
