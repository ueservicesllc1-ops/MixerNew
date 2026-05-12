; Incluido por electron-builder (NSIS asistido). Sin esto, el wizard puede sentirse "vacío" al inicio.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Matar cualquier proceso cuyo ejecutable esté bajo $R6 (ruta de instalación). Complementa taskkill /IM
; (Electron a veces deja procesos con rutas bajo la carpeta pero nombres raros / handles vivos).
!macro ZionKillProcessesUnderPath
  ${If} $R6 != ""
    DetailPrint "Zion Stage: cerrando procesos bajo $R6 (por ruta)..."
    ; Pasar la ruta por variable de entorno para evitar líos de comillas NSIS/PowerShell.
    ExecWait `cmd.exe /c set "ZION_KILL_ROOT=$R6" && powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$$p = $$env:ZION_KILL_ROOT; if ($$null -eq $$p -or $$p.Length -lt 3) { exit 0 }; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$p, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"` $0
    Sleep 3000
  ${EndIf}
!macroend

; Antes de que el instalador intente cerrar Zion Stage por mensajes internos, forzar fin de proceso
; (main + helpers de Chromium). Evita el diálogo "cannot be closed" cuando no hay ventana visible.
!macro preInit
  DetailPrint "Zion Stage: cerrando procesos anteriores si siguen en ejecución..."
  ExecWait 'cmd.exe /c taskkill /F /T /IM "Zion Stage.exe" 1>nul 2>nul & taskkill /F /T /IM "ZionStage.exe" 1>nul 2>nul & taskkill /F /T /IM "Uninstall ${PRODUCT_FILENAME}.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (GPU).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Renderer).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Plugin).exe" 1>nul 2>nul & exit /b 0' $0
  Sleep 1200
!macroend

; Tras initMultiUser ya suele existir $INSTDIR de la instalación anterior: segundo barrido antes del
; desinstalador silencioso (si falla, aparece "cannot be closed" / Reintentar).
!macro customInit
  DetailPrint "Zion Stage: cierre forzado (customInit) antes de desinstalar versión previa..."
  ExecWait 'cmd.exe /c taskkill /F /T /IM "Zion Stage.exe" 1>nul 2>nul & taskkill /F /T /IM "ZionStage.exe" 1>nul 2>nul & taskkill /F /T /IM "Uninstall ${PRODUCT_FILENAME}.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (GPU).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Renderer).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Plugin).exe" 1>nul 2>nul & exit /b 0' $0
  ${If} ${FileExists} `$INSTDIR\${APP_EXECUTABLE_FILENAME}`
    ExecWait 'cmd.exe /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" 1>nul 2>nul & exit /b 0' $0
  ${EndIf}
  ReadRegStr $R6 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R6 == ""
    ReadRegStr $R6 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${EndIf}
  ${If} $R6 == ""
    StrCpy $R6 "$INSTDIR"
  ${EndIf}
  !insertmacro ZionKillProcessesUnderPath
  Sleep 2500
!macroend

; Sustituye el CHECK_APP_RUNNING por defecto (PowerShell Get-CimInstance bajo $INSTDIR), que a veces
; no detecta bien procesos Electron y dispara "cannot be closed" / bucles sin llegar a desinstalar.
; Este macro corre en la sección de instalación justo antes de uninstallOldVersion.
!macro customCheckAppRunning
  DetailPrint "Zion Stage: cierre forzado inmediato antes de actualizar (customCheckAppRunning)..."
  ExecWait 'cmd.exe /c taskkill /F /T /IM "Zion Stage.exe" 1>nul 2>nul & taskkill /F /T /IM "ZionStage.exe" 1>nul 2>nul & taskkill /F /T /IM "Uninstall ${PRODUCT_FILENAME}.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (GPU).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Renderer).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Plugin).exe" 1>nul 2>nul & exit /b 0' $0
  Sleep 2000
  ${If} ${FileExists} `$INSTDIR\${APP_EXECUTABLE_FILENAME}`
    ExecWait 'cmd.exe /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" 1>nul 2>nul & exit /b 0' $0
    Sleep 1500
  ${EndIf}
  ExecWait 'cmd.exe /c taskkill /F /T /IM "Zion Stage.exe" 1>nul 2>nul & taskkill /F /T /IM "ZionStage.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (GPU).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Renderer).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Plugin).exe" 1>nul 2>nul & exit /b 0' $0
  Sleep 2000
  ReadRegStr $R6 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R6 == ""
    ReadRegStr $R6 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${EndIf}
  ${If} $R6 == ""
    StrCpy $R6 "$INSTDIR"
  ${EndIf}
  !insertmacro ZionKillProcessesUnderPath
  Sleep 2000
  ; Si el desinstalador silencioso de una versión vieja devuelve error (bloqueos, NSIS viejo, etc.),
  ; electron-builder muestra "cannot be closed" aunque no haya UI. Sin entradas de desinstalación,
  ; uninstallOldVersion sale sin ExecWait y este setup copia encima de $INSTDIR (ya matamos procesos).
  DetailPrint "Zion Stage: quitando registro de instalación anterior para omitir desinstalador defectuoso..."
  ClearErrors
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
  ClearErrors
!macroend

; Desinstalador (incl. modo /S cuando el instalador nuevo invoca el viejo): libera la carpeta antes de borrar.
!macro customUnInit
  DetailPrint "Zion Stage: cierre forzado (desinstalador customUnInit)..."
  ExecWait 'cmd.exe /c taskkill /F /T /IM "Zion Stage.exe" 1>nul 2>nul & taskkill /F /T /IM "ZionStage.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper.exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (GPU).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Renderer).exe" 1>nul 2>nul & taskkill /F /T /IM "Zion Stage Helper (Plugin).exe" 1>nul 2>nul & exit /b 0' $0
  StrCpy $R6 "$INSTDIR"
  !insertmacro ZionKillProcessesUnderPath
!macroend
