<#
.SYNOPSIS
    Bottom-up Canvas Generator - PowerShell version
.DESCRIPTION
    Generates multiple Obsidian Canvas views from vault metadata.
    Run this script from the Obsidian_test directory.
#>
param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Add parent directory to Python path
$ParentDir = Resolve-Path (Join-Path $ScriptDir "..")
$env:PYTHONPATH = "$ParentDir;$env:PYTHONPATH"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bottom-up Canvas Generator" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Canvas A: All notes, timeline by year ---
Write-Host "[1/4] Generating full timeline canvas..." -ForegroundColor Yellow
python -m canvas_gen.main `
    --vault "vault" `
    --output "vault\timeline.canvas" `
    --x-axis-key year `
    --column-width 350 `
    --row-height 250
if ($LASTEXITCODE -ne 0) { throw "Generation failed" }

# --- Canvas B: Characters only ---
Write-Host "[2/4] Generating character relation canvas..." -ForegroundColor Yellow
python -m canvas_gen.main `
    --vault "vault" `
    --output "vault\characters.canvas" `
    --filter "type=character" `
    --sort-by title
if ($LASTEXITCODE -ne 0) { throw "Generation failed" }

# --- Canvas C: Scenarios only ---
Write-Host "[3/4] Generating scenario canvas..." -ForegroundColor Yellow
python -m canvas_gen.main `
    --vault "vault" `
    --output "vault\scenarios.canvas" `
    --filter "type=scenario" `
    --sort-by year
if ($LASTEXITCODE -ne 0) { throw "Generation failed" }

# --- Canvas D: Events timeline ---
Write-Host "[4/4] Generating event timeline canvas..." -ForegroundColor Yellow
python -m canvas_gen.main `
    --vault "vault" `
    --output "vault\events.canvas" `
    --filter "type=event" `
    --x-axis-key year `
    --sort-by year
if ($LASTEXITCODE -ne 0) { throw "Generation failed" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All canvases generated successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open the vault in Obsidian to view:" -ForegroundColor White
Write-Host "  - timeline.canvas   (all notes by year)" -ForegroundColor White
Write-Host "  - characters.canvas (character network)" -ForegroundColor White
Write-Host "  - scenarios.canvas  (scenario list)" -ForegroundColor White
Write-Host "  - events.canvas     (event timeline)" -ForegroundColor White
