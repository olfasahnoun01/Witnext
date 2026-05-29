# Stops lock holders and prunes electron-builder output (LocalAppData + legacy repo folders).
$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$projectSlug = Split-Path -Leaf $root
$buildRoot = if ($env:ELECTRON_BUILD_ROOT) { $env:ELECTRON_BUILD_ROOT } else { Join-Path $env:LOCALAPPDATA 'Alpha-electron-build' }
$runsRoot = Join-Path $buildRoot 'runs'

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
        $_.ExecutablePath -like "*\.build-cache\*" -or
        $_.ExecutablePath -like "*\Alpha-electron-build\*"
      )
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

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

function Remove-DirBestEffort([string]$dir) {
  if (-not (Test-Path $dir)) { return $true }
  for ($i = 0; $i -lt 4; $i++) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $dir)) { return $true }
    Stop-LockingProcesses
    Start-Sleep -Seconds 1
  }
  return -not (Test-Path $dir)
}

function Prune-OldRuns([string]$dir, [int]$keep = 2) {
  if (-not (Test-Path $dir)) { return }
  $runs = Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if (-not $runs) { return }
  foreach ($run in $runs | Select-Object -Skip $keep) {
    Remove-DirBestEffort $run.FullName | Out-Null
  }
}

Stop-LockingProcesses
Start-Sleep -Seconds 1

# Legacy in-repo cache (Desktop / OneDrive — often locked; best effort only).
$legacyDirs = @(
  (Join-Path $root '.build-cache'),
  (Join-Path $root 'release\win-unpacked')
)
$legacyLocked = @()
foreach ($dir in $legacyDirs) {
  if (-not (Test-Path $dir)) { continue }
  if (-not (Remove-DirBestEffort $dir)) {
    $legacyLocked += $dir
  }
}

Prune-OldRuns $runsRoot 2

$marker = Join-Path $root '.electron-build-dir'
if (Test-Path $marker) {
  Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
}

if ($legacyLocked.Count -gt 0) {
  Write-Host 'Legacy folders still locked (safe to ignore; builds use LocalAppData now):'
  $legacyLocked | ForEach-Object { Write-Host "  $_" }
}

Write-Host "Electron build cache cleaned (output root: $buildRoot)."
exit 0
