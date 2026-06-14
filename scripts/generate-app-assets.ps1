# Witnext branding assets (UI icons + Electron .ico).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root 'src\assets'
$brandingDir = Join-Path $root 'build\branding'
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
New-Item -ItemType Directory -Force -Path $brandingDir | Out-Null

function Save-SquareIcon {
  param(
    [string]$SourcePath,
    [string]$DestPath,
    [int]$Size
  )
  if (-not (Test-Path $SourcePath)) {
    throw "Missing source image: $SourcePath"
  }
  $source = [System.Drawing.Image]::FromFile((Resolve-Path $SourcePath))
  $icon = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($icon)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($source, 0, 0, $Size, $Size)
  $g.Dispose()
  $source.Dispose()
  $icon.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $icon.Dispose()
  Write-Host "Created $DestPath (${Size}x${Size})"
}

$iconSrc = Join-Path $brandingDir 'app-icon.png'
if (-not (Test-Path $iconSrc)) {
  $fallback = Join-Path $assetsDir 'witnext-brand-logo-icon.png'
  if (Test-Path $fallback) {
    Copy-Item $fallback $iconSrc -Force
    Write-Host "Copied $fallback -> $iconSrc"
  } else {
    throw "Missing build/branding/app-icon.png or src/assets/witnext-brand-logo-icon.png"
  }
}

Get-ChildItem (Join-Path $assetsDir 'logo-icon*.png') -ErrorAction SilentlyContinue | Remove-Item -Force
Save-SquareIcon -SourcePath $iconSrc -DestPath (Join-Path $assetsDir 'logo-icon-256.png') -Size 256
Save-SquareIcon -SourcePath $iconSrc -DestPath (Join-Path $assetsDir 'logo-icon-512.png') -Size 512
Save-SquareIcon -SourcePath $iconSrc -DestPath (Join-Path $assetsDir 'logo-icon-1024.png') -Size 1024
Copy-Item (Join-Path $assetsDir 'logo-icon-512.png') (Join-Path $root 'public\favicon.png') -Force

Write-Host 'Generating build/icon.ico from logo-icon-512.png...'
node (Join-Path $root 'scripts\generate-icon-ico.mjs')

Write-Host 'Done: Witnext logo-icon sizes + favicon + build/icon.ico.'
