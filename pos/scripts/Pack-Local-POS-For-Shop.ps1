param(
  [string]$Destination = ""
)

$ErrorActionPreference = "Stop"
$PosRoot = Split-Path -Parent $PSScriptRoot
$ShopJson = Join-Path $PosRoot "src\data\shop.json"
$ShopShortName = "Al-rehman"
if (Test-Path $ShopJson) {
  try {
    $shop = Get-Content $ShopJson -Raw | ConvertFrom-Json
    if ($shop.shortName) { $ShopShortName = [string]$shop.shortName }
  } catch {}
}

function Stop-WithMessage([string]$Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "$ShopShortName POS - pack for shop PC (no npm on shop)" -ForegroundColor Cyan
Write-Host "Copies an already-built POS so the shop never downloads dependencies."
Write-Host ""

$buildId = Join-Path $PosRoot ".next\BUILD_ID"
$modules = Join-Path $PosRoot "node_modules"
$envFile = Join-Path $PosRoot ".env.local"
if (-not (Test-Path $buildId)) {
  Stop-WithMessage "No production build found. Run Setup-Local-POS.bat on this PC first."
}
if (-not (Test-Path $modules)) {
  Stop-WithMessage "node_modules missing. Run Setup-Local-POS.bat on this PC first."
}
if (-not (Test-Path $envFile)) {
  Stop-WithMessage ".env.local missing. Run Setup-Local-POS.bat once so the API URL is set."
}

if (-not $Destination) {
  $Desktop = [Environment]::GetFolderPath("Desktop")
  $default = Join-Path $Desktop "$ShopShortName-POS-Ready"
  Write-Host "Default destination: $default"
  Write-Host "Press Enter to use it, or paste a USB/folder path."
  $typed = (Read-Host "Destination folder").Trim()
  $Destination = if ($typed) { $typed } else { $default }
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null

function Copy-PosItem([string]$Relative) {
  $src = Join-Path $PosRoot $Relative
  if (-not (Test-Path $src)) { return }
  $dst = Join-Path $Destination $Relative
  $dstParent = Split-Path -Parent $dst
  if ($dstParent) {
    New-Item -ItemType Directory -Force -Path $dstParent | Out-Null
  }
  Write-Host "  copying $Relative ..."
  if (Test-Path $src -PathType Container) {
    # /MIR keeps pack folder in sync; /XD skips junk that is not needed to run.
    & robocopy.exe $src $dst /E /NFL /NDL /NJH /NJS /nc /ns /np `
      /XD ".cache" ".vite" "cache" `
      /XF "*.map" ".DS_Store" | Out-Null
    if ($LASTEXITCODE -ge 8) {
      throw "robocopy failed for $Relative (exit $LASTEXITCODE)"
    }
  } else {
    Copy-Item -Force -Path $src -Destination $dst
  }
}

Write-Host ""
Write-Host "Packing into: $Destination" -ForegroundColor Cyan

# Runtime essentials only — same app the till already runs.
$items = @(
  "package.json",
  "package-lock.json",
  ".env.local",
  ".pos-install-stamp",
  ".next",
  "node_modules",
  "public",
  "scripts",
  "src\data"
)
foreach ($item in $items) {
  Copy-PosItem $item
}

# Shop helper: shortcut only, no npm.
$installShop = Join-Path $Destination "INSTALL-ON-SHOP.txt"
@"
$ShopShortName POS — install on shop PC
=====================================

1. Copy this whole folder to the shop PC (USB / disk).
2. Install Node.js 20 LTS and Google Chrome if missing.
3. Double-click: scripts\Install-Packed-POS.bat
4. Cashiers use the desktop shortcut every day.

Do NOT run Setup-Local-POS on the shop PC unless you are updating
from source. This pack already includes node_modules and the build.
"@ | Set-Content -Path $installShop -Encoding UTF8

Write-Host ""
Write-Host "Pack ready." -ForegroundColor Green
Write-Host "Folder: $Destination"
Write-Host "On the shop PC run: scripts\Install-Packed-POS.bat"
Write-Host ""
Read-Host "Press Enter to close"
