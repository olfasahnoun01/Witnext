# Stops common lock holders and clears unpacked build folders.
$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$projectSlug = Split-Path -Leaf $root

function Stop-LockingProcesses {
  $names = @('Alpha', 'electron', 'Installer', 'Alpha Installer')
  foreach ($name in $names) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force
  }

  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ExecutablePath -and (
        $_.ExecutablePath -like "*\win-unpacked\*" -or
        $_.ExecutablePath -like "*\release\*Alpha*" -or
        $_.ExecutablePath -like "*\.build-cache\*"
      )
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  # Dev server / electron-builder node processes tied to this repo (not Cursor itself).
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $cmd = $_.CommandLine
      if (-not $cmd) { return $false }
      $cmd -like "*$projectSlug*" -and (
        $cmd -match 'electron-builder' -or
        $cmd -match 'electron\\' -or
        $cmd -match 'electron:dev' -or
        $cmd -match 'wait-on'
      )
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Remove-BuildDir([string]$dir) {
  if (-not (Test-Path $dir)) { return $true }
  for ($i = 0; $i -lt 6; $i++) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $dir)) { return $true }
    Stop-LockingProcesses
    Start-Sleep -Seconds 2
  }
  return -not (Test-Path $dir)
}

Stop-LockingProcesses
Start-Sleep -Seconds 1

$dirs = @(
  (Join-Path $root '.build-cache\win-unpacked'),
  (Join-Path $root 'release\win-unpacked')
)

$locked = @()
foreach ($dir in $dirs) {
  if (-not (Remove-BuildDir $dir)) {
    $locked += $dir
  }
}

if ($locked.Count -gt 0) {
  Write-Warning @"
Could not remove (file in use):
$($locked -join "`n")

Close Alpha / Electron / the setup installer, then:
  - Close File Explorer windows on .build-cache or release
  - Stop npm run electron:dev if it is running
  - Pause OneDrive sync (project is on Desktop)
  - Wait ~30s if antivirus is scanning app.asar

Then run: npm run electron:clean
"@
  exit 1
}

Write-Host 'Electron build folders cleaned.'
exit 0
