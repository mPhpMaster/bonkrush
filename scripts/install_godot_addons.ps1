#!/usr/bin/env pwsh
# Installs Godot addons required by 3D Monster RPG (Terrain3D with binaries).
# Run from repo root: pwsh scripts/install_godot_addons.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Join-Path $PSScriptRoot ".." | Resolve-Path
$AddonsDir = Join-Path $RepoRoot "game\addons"
$TerrainDir = Join-Path $AddonsDir "terrain_3d"
$ReleaseUrl = "https://github.com/TokisanGames/Terrain3D/releases/download/v1.0.2-stable/Terrain3D_v1.0.2-stable.zip"
$ZipPath = Join-Path $env:TEMP "Terrain3D_v1.0.2-stable.zip"
$ExtractPath = Join-Path $env:TEMP "terrain3d_install"

Write-Host "Addons directory: $AddonsDir"

if (-not (Test-Path $TerrainDir)) {
    Write-Host "Downloading Terrain3D v1.0.2 (includes Windows DLLs)..."
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $ZipPath
    Remove-Item -Recurse -Force $ExtractPath -ErrorAction SilentlyContinue
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force
    Copy-Item -Path (Join-Path $ExtractPath "addons\terrain_3d") -Destination $TerrainDir -Recurse -Force
    Write-Host "Terrain3D installed."
} else {
    $binDir = Join-Path $TerrainDir "bin"
    $dll = Join-Path $binDir "libterrain.windows.release.x86_64.dll"
    if (-not (Test-Path $dll)) {
        Write-Host "Terrain3D folder exists but Windows DLLs missing — downloading binaries..."
        Invoke-WebRequest -Uri $ReleaseUrl -OutFile $ZipPath
        Remove-Item -Recurse -Force $ExtractPath -ErrorAction SilentlyContinue
        Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force
        New-Item -ItemType Directory -Force -Path $binDir | Out-Null
        Copy-Item (Join-Path $ExtractPath "addons\terrain_3d\bin\libterrain.windows.*.dll") $binDir -Force
        Write-Host "Terrain3D binaries installed."
    } else {
        Write-Host "Terrain3D already present with Windows binaries."
    }
}

Write-Host ""
Write-Host "Next: open game/ in Godot 4.4+ and enable Terrain3D in Project Settings > Plugins."
