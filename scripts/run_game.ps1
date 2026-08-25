#!/usr/bin/env pwsh
# Launch 3D Monster RPG
param(
    [switch]$Demo
)

$GamePath = Join-Path $PSScriptRoot "..\game" | Resolve-Path
$Args = @("--path", $GamePath)
if ($Demo) { $Args += "--demo" }

Write-Host "Starting 3D Monster RPG..."
if ($Demo) { Write-Host "  Mode: Demo (offline)" }
Start-Process godot -ArgumentList $Args
