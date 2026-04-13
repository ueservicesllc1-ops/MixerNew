@echo off
:: ============================================================
:: install-debug.cmd — Compila APK debug e instala en tablet USB
:: Uso: doble clic o ejecutar desde cualquier terminal
:: ============================================================
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "APK=%~dp0..\android\app\build\outputs\apk\debug\app-debug.apk"
set "GRADLE=%~dp0..\android\gradlew.bat"

echo ============================================================
echo  Mixer — Build y Deploy Debug
echo ============================================================
echo.

:: 1. Verificar tablet conectada
echo [1/3] Verificando dispositivo USB...
"%ADB%" devices
echo.

:: 2. Compilar APK debug
echo [2/3] Compilando APK debug (puede tardar 1-2 min)...
pushd "%~dp0..\android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Fallo el build. Revisa los logs arriba.
    popd
    pause
    exit /b 1
)
popd
echo.

:: 3. Instalar en tablet
echo [3/3] Instalando en tablet...
"%ADB%" install -r "%APK%"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Instalacion exitosa! Abre el Mixer en la tablet.
) else (
    echo.
    echo ERROR: Fallo la instalacion. Revisa que la tablet este en Modo Depuracion USB.
)
echo.
pause
