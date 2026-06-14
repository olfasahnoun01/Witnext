# Witnext — single logo (witnext-brand-logo-icon.png) → transparent PNG, favicon, Electron .ico
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root 'src\assets'
$brandingDir = Join-Path $root 'build\branding'
$master = Join-Path $assetsDir 'witnext-brand-logo-icon.png'

if (-not (Test-Path $master)) {
  throw "Missing master logo: $master"
}

New-Item -ItemType Directory -Force -Path $brandingDir | Out-Null

function Remove-NearWhiteBackground {
  param(
    [string]$Path,
    [int]$Threshold = 242
  )
  $resolved = (Resolve-Path $Path).Path
  $img = [System.Drawing.Bitmap]::FromFile($resolved)
  $out = New-Object System.Drawing.Bitmap $img.Width, $img.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($x = 0; $x -lt $img.Width; $x++) {
    for ($y = 0; $y -lt $img.Height; $y++) {
      $c = $img.GetPixel($x, $y)
      if ($c.R -ge $Threshold -and $c.G -ge $Threshold -and $c.B -ge $Threshold) {
        $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
      } else {
        $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, $c.R, $c.G, $c.B))
      }
    }
  }
  $img.Dispose()
  $tmp = "$resolved.tmp.png"
  $out.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  Move-Item -Force $tmp $resolved
  Write-Host "Removed near-white background: $Path"
}

function Save-SquareIcon {
  param(
    [string]$SourcePath,
    [string]$DestPath,
    [int]$Size
  )
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourcePath))
  $icon = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($icon)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($source, 0, 0, $Size, $Size)
  $g.Dispose()
  $source.Dispose()
  $icon.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $icon.Dispose()
  Write-Host "Created $DestPath (${Size}x${Size})"
}

Remove-NearWhiteBackground -Path $master

$square512 = Join-Path $brandingDir 'app-icon-512.png'
Save-SquareIcon -SourcePath $master -DestPath $square512 -Size 512
Copy-Item $square512 (Join-Path $root 'public\favicon.png') -Force
Write-Host "Updated public/favicon.png"

node (Join-Path $root 'scripts\generate-icon-ico.mjs')

Write-Host 'Done: transparent logo + favicon + build/icon.ico'
