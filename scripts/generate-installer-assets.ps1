# Three logo variants from build/installer/source/installer-sidebar.png:
# 1) Installer NSIS BMP (164x314)
# 2) App UI banner for login + sidebar (logo-app*.png)
# 3) Square app icon (logo-icon*.png)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'build\installer'
$assetsDir = Join-Path $root 'src\assets'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
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
  $format = [System.Drawing.Imaging.ImageFormat]::Bmp
  if ($DestPath -match '\.png$') { $format = [System.Drawing.Imaging.ImageFormat]::Png }
  $dest.Save($DestPath, $format)
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

$sidebarSrc = Join-Path $root 'build\installer\source\installer-sidebar.png'
$headerSrc = Join-Path $root 'build\installer\source\installer-header.png'

if (-not (Test-Path $sidebarSrc)) {
  throw "Missing $sidebarSrc"
}
if (-not (Test-Path $headerSrc)) {
  throw "Missing $headerSrc"
}

# --- 1) Installer (NSIS only) ---
Save-ResizedImage -SourcePath $sidebarSrc -DestPath (Join-Path $outDir 'installerSidebar.bmp') -Width 164 -Height 314
Save-ResizedImage -SourcePath $headerSrc -DestPath (Join-Path $outDir 'installerHeader.bmp') -Width 150 -Height 57

# --- 2) App UI (auth + in-app sidebar) — aspect 164:314 ---
# Display ~144px (auth) / ~64px (sidebar); 2x assets stay sharp on HiDPI.
Get-ChildItem (Join-Path $assetsDir 'logo-app*.png') -ErrorAction SilentlyContinue | Remove-Item -Force
Save-ResizedImage -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-app.png') -Width 144 -Height 276
Save-ResizedImage -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-app-2x.png') -Width 288 -Height 552

# --- 3) App icon (favicon, Electron, taskbar) ---
Get-ChildItem (Join-Path $assetsDir 'logo-icon*.png') -ErrorAction SilentlyContinue | Remove-Item -Force
Save-SquareIcon -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-icon-256.png') -Size 256
Save-SquareIcon -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-icon-512.png') -Size 512
Save-SquareIcon -SourcePath $sidebarSrc -DestPath (Join-Path $assetsDir 'logo-icon-1024.png') -Size 1024
Copy-Item (Join-Path $assetsDir 'logo-icon-512.png') (Join-Path $root 'public\favicon.png') -Force

# Legacy filenames (remove to avoid confusion)
@(
  'alpha-logo.png',
  'alpha-logo-banner.png',
  'alpha-logo-banner-2x.png',
  'alpha-logo-banner-3x.png'
) | ForEach-Object {
  $p = Join-Path $assetsDir $_
  if (Test-Path $p) { Remove-Item $p -Force }
}

Write-Host 'Generating NSIS .ico from logo-icon-256.png...'
& powershell -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\generate-icon-ico.ps1')

Write-Host 'Done: installer BMP + logo-app (UI) + logo-icon (app icon) + build/icon.ico.'
