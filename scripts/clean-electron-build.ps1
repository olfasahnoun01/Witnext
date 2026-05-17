# Stops common lock holders and clears unpacked build folders.
$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot

# Kill by process name
$names = @('Alpha', 'electron', 'Installer', 'Alpha Installer')
foreach ($name in $names) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force
}

# Kill anything running from win-unpacked (dev / leftover Electron)
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.ExecutablePath -and (
      $_.ExecutablePath -like "*\win-unpacked\*" -or
      $_.ExecutablePath -like "*\release\*Alpha*" -or
      $_.ExecutablePath -like "*\.build-cache\*"
    )
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

$dirs = @(
  (Join-Path $root '.build-cache\win-unpacked'),
  (Join-Path $root '.build-cache\installer\win-unpacked'),
  (Join-Path $root 'release\win-unpacked')
)

$locked = @()
foreach ($dir in $dirs) {
  if (-not (Test-Path $dir)) { continue }
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path $dir) {
    $locked += $dir
  }
}

if ($locked.Count -gt 0) {
  Write-Warning @"
Could not remove (file in use):
$($locked -join "`n")
Close Alpha / Installer / Electron, close Explorer on release\, pause OneDrive sync, then run: npm run electron:clean
Builds now use .build-cache\win-unpacked — stale release\win-unpacked can be ignored if clean fails.
"@
} else {
  Write-Host 'Electron build folders cleaned.'
}
