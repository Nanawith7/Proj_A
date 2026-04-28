@echo off
setlocal
cd /d "%~dp0"

REM Add parent directory to Python path so canvas_gen can be imported
set PYTHONPATH=%~dp0..;%PYTHONPATH%

echo ========================================
echo  Bottom-up Canvas Generator
echo ========================================
echo.

REM --- Canvas A: All notes, timeline by year ---
echo [1/4] Generating full timeline canvas...
python -m canvas_gen.main ^
    --vault "vault" ^
    --output "vault\timeline.canvas" ^
    --x-axis-key year ^
    --column-width 350 ^
    --row-height 250
IF %ERRORLEVEL% NEQ 0 goto :error

REM --- Canvas B: Characters only ---
echo [2/4] Generating character relation canvas...
python -m canvas_gen.main ^
    --vault "vault" ^
    --output "vault\characters.canvas" ^
    --filter "type=character" ^
    --sort-by title
IF %ERRORLEVEL% NEQ 0 goto :error

REM --- Canvas C: Scenarios only, with linked targets ---
echo [3/4] Generating scenario canvas...
python -m canvas_gen.main ^
    --vault "vault" ^
    --output "vault\scenarios.canvas" ^
    --filter "type=scenario" ^
    --sort-by year
IF %ERRORLEVEL% NEQ 0 goto :error

REM --- Canvas D: Events timeline ---
echo [4/4] Generating event timeline canvas...
python -m canvas_gen.main ^
    --vault "vault" ^
    --output "vault\events.canvas" ^
    --filter "type=event" ^
    --x-axis-key year ^
    --sort-by year
IF %ERRORLEVEL% NEQ 0 goto :error

echo.
echo ========================================
echo  All canvases generated successfully!
echo ========================================
echo.
echo Open the vault in Obsidian to view:
echo   - timeline.canvas  (all notes by year)
echo   - characters.canvas  (character network)
echo   - scenarios.canvas   (scenario list)
echo   - events.canvas      (event timeline)
echo.
pause
goto :eof

:error
echo.
echo [ERROR] Generation failed! Check the trace above.
pause
exit /b 1
