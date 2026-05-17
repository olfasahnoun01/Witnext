# Stops common lock holders and clears unpacked build folders.
$ErrorActionPreference = 'SilentlyContinue'

$names = @('Alpha', 'electron', 'Installer')
foreach ($name in $names) {
  Get-Process -Name $name | Stop-Process -Force
}

Start-Sleep -Seconds 1

$root = Split-Path -Parent $PSScriptRoot
$dirs = @(
  (Join-Path $root '.build-cache\win-unpacked'),
  (Join-Path $root '.build-cache\installer\win-unpacked'),
  (Join-Path $root 'release\win-unpacked')
)

foreach ($dir in $dirs) {
  if (Test-Path $dir) {
    Remove-Item -LiteralPath $dir -Recurse -Force
    if (Test-Path $dir) {
      Write-Warning "Could not remove $dir (file in use). Close Alpha/Installer, Explorer windows on release\, and pause OneDrive, then retry."
    }
  }
}

Write-Host 'Electron build folders cleaned (where not locked).'
