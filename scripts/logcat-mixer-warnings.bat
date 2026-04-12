@echo off
chcp 65001 >nul
title Logcat: solo WARN y ERROR (todo el sistema, menos líneas)
echo Menos ruido: solo advertencias y errores. Ctrl+C para salir.
adb logcat -v threadtime *:W
