#!/usr/bin/env pwsh
Set-Location $PSScriptRoot
Write-Host "BONKRUSH  ->  http://localhost:4173"
Start-Process "http://localhost:4173"
npx --yes serve . -p 4173
