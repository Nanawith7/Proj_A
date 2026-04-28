<#
.SYNOPSIS
    Canvas Viewer HTTP Server Launcher
.DESCRIPTION
    Start the interactive HTML viewer for a .canvas file.
    Open http://127.0.0.1:8765/ in your browser.
.PARAMETER Vault
    Path to Obsidian vault root.
.PARAMETER Canvas
    Path to .canvas file.
.PARAMETER Port
    HTTP port (default 8765).
.EXAMPLE
    .\start.ps1
    .\start.ps1 -Vault "C:\my_vault" -Canvas "timeline.canvas" -Port 8765
#>
param(
    [string]$Vault = "..\Obsidian_test\vault",
    [string]$Canvas = "..\Obsidian_test\vault\timeline.canvas",
    [int]$Port = 8765
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ParentDir = Resolve-Path (Join-Path $ScriptDir "..")
$env:PYTHONPATH = "$ParentDir;$env:PYTHONPATH"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Canvas Viewer Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vault:  $Vault"
Write-Host "  Canvas: $Canvas"
Write-Host "  Port:   $Port"
Write-Host ""
Write-Host "  Open: http://127.0.0.1:${Port}/" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

python -m canvas_gen.main --vault $Vault --serve-viewer "${Canvas}:${Port}"
