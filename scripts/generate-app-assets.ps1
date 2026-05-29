# App branding assets (UI logos + Electron .ico). No custom NSIS installer assets.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root 'src\assets'
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function Save-ResizedImage {
  param(
    [string]$SourcePath,
    [string]$DestPath,
    [int]$Width,
    [int]$Height
  )
  if (-not (Test-Path $SourcePath)) {
    throw "Missing source image: $SourcePath"
  }
  $dest = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($dest)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.Clear([System.Drawing.Color]::FromArgb(27, 53, 84))
  $source = [System.Drawing.Image]::FromFile((Resolve-Path $SourcePath))
  $graphics.DrawImage($source, 0, 0, $Width, $Height)
  $graphics.Dispose()
  $source.Dispose()
  $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $dest.Dispose()
  Write-Host "Created $DestPath (${Width}x${Height})"
}

function Save-SquareIcon {
  param(
    [string]$SourcePath,
    [string]$DestPath,
    [int]$Size
  )
  $source = [System.Drawing.Image]::FromFile((Resolve-Path $SourcePath))
  $icon = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($icon)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($source, 0, 0, $Size, $Size)
  $g.Dispose()
  $source.Dispose()
  $icon.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $icon.Dispose()
  Write-Host "Created $DestPath (${Size}x${Size})"
}

$sidebarSrc = Join-Path $root 'build\branding\sidebar.png'
if (-not (Test-Path $sidebarSrc)) {
  $legacy = Join-Path $root 'build\installer\source\installer-sidebar.png'
  if (Test-Path $legacy) {
    $sidebarSrc = $legacy
  } else {
    throw "Missing branding source: build/branding/sidebar.png"
  }
}

Get-ChildItem (Join-Path $assetsDir 'logo-app*.png') -ErrorAction SilentlyContinue | Remove-Item -Force
Save-ResizedImage -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-app.png') -Width 144 -Height 276
Save-ResizedImage -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-app-2x.png') -Width 288 -Height 552

$iconSrc = Join-Path $root 'build\branding\app-icon.png'
if (-not (Test-Path $iconSrc)) {
  $legacy = Join-Path $root 'build\installer\source\app-icon.png'
  if (Test-Path $legacy) {
    $iconSrc = $legacy
  } else {
    $iconSrc = $sidebarSrc
    Write-Host 'Tip: add build/branding/app-icon.png (square) for exact desktop/taskbar icon.'
  }
}

Get-ChildItem (Join-Path $assetsDir 'logo-icon*.png') -ErrorAction SilentlyContinue | Remove-Item -Force
Save-SquareIcon -SourcePath $iconSrc -DestPath (Join-Path $assetsDir 'logo-icon-256.png') -Size 256
Save-SquareIcon -SourcePath $iconSrc -DestPath (Join-Path $assetsDir 'logo-icon-512.png') -Size 512
Save-SquareIcon -SourcePath $iconSrc -DestPath (Join-Path $assetsDir 'logo-icon-1024.png') -Size 1024
Copy-Item (Join-Path $assetsDir 'logo-icon-512.png') (Join-Path $root 'public\favicon.png') -Force

Write-Host 'Generating build/icon.ico from logo-icon-512.png...'
node (Join-Path $root 'scripts\generate-icon-ico.mjs')

Write-Host 'Done: logo-app (UI) + logo-icon (app icon) + build/icon.ico.'
