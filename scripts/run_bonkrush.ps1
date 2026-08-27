#!/usr/bin/env pwsh
# Launch BONKRUSH in the browser
$ErrorActionPreference = "Stop"
$Root = Join-Path $PSScriptRoot "..\bonkrush" | Resolve-Path
Set-Location $Root

$port = 4173
$url = "http://localhost:$port"
Write-Host "BONKRUSH  ->  $url"
Start-Process $url
npx --yes serve . -p $port
