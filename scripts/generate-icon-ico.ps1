# NSIS requires .ico — PNG is rejected by makensis.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $root 'src\assets\logo-icon-256.png'

if (-not (Test-Path $pngPath)) {
  throw "Missing $pngPath (run npm run installer:assets first)."
}

$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $pngPath))
try {
  $hIcon = $bmp.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($hIcon)
  $targets = @(
    (Join-Path $root 'build\icon.ico'),
    (Join-Path $root 'build\installer\icon.ico')
  )
  foreach ($dest in $targets) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    $fs = [System.IO.File]::Open($dest, [System.IO.FileMode]::Create)
    try {
      $icon.Save($fs)
    } finally {
      $fs.Close()
    }
    Write-Host "Wrote $dest"
  }
} finally {
  $bmp.Dispose()
}
