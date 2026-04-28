# Canvas Viewer - HTTP Server Launcher
# 
# Usage:
#   start.bat                    (uses default Obsidian_test vault)
#   start.bat "path/to/vault" "path/to/timeline.canvas"
#   start.bat "path/to/vault" "path/to/canvas" 8765

@echo off
setlocal
cd /d "%~dp0"

set VAULT=..\Obsidian_test\vault
set CANVAS=..\Obsidian_test\vault\timeline.canvas
set PORT=8765

if not "%~1"=="" set VAULT=%~1
if not "%~2"=="" set CANVAS=%~2
if not "%~3"=="" set PORT=%~3

set PYTHONPATH=%~dp0..;%PYTHONPATH%

echo ========================================
echo  Canvas Viewer Server
echo ========================================
echo  Vault:  %VAULT%
echo  Canvas: %CANVAS%
echo  Port:   %PORT%
echo.
echo  Open: http://127.0.0.1:%PORT%/
echo  Press Ctrl+C to stop.
echo ========================================

python -m canvas_gen.main --vault "%VAULT%" --serve-viewer "%CANVAS%:%PORT%"

endlocal
