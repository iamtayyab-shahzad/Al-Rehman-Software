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
$PosAppTitle = "$ShopShortName POS"

function Stop-WithMessage([string]$Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "$PosAppTitle - install packed build (no download)" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $PosRoot ".next\BUILD_ID"))) {
  Stop-WithMessage "This folder is not a packed POS build. On your PC run Setup then Pack-Local-POS-For-Shop."
}
if (-not (Test-Path (Join-Path $PosRoot "node_modules"))) {
  Stop-WithMessage "node_modules missing from this pack. Re-run Pack-Local-POS-For-Shop on the owner PC."
}
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Stop-WithMessage "Node.js 20+ is required. Install LTS from https://nodejs.org then run this again."
}
$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) {
  Stop-WithMessage "Node.js 20+ is required. Installed: $(node --version)."
}

$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "$PosAppTitle.lnk"
$LauncherPath = Join-Path $PSScriptRoot "Launch-POS-Local.vbs"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$Shortcut.Arguments = "`"$LauncherPath`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "$PosAppTitle - local production app"

$ChromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$Chrome = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($Chrome) {
  $Shortcut.IconLocation = "$Chrome,0"
}
$Shortcut.Save()

$LegacyShortcut = Join-Path $Desktop "Krunchies POS.lnk"
if ((Test-Path $LegacyShortcut) -and ($LegacyShortcut -ne $ShortcutPath)) {
  Remove-Item $LegacyShortcut -Force -ErrorAction SilentlyContinue
}

Write-Host "Ready. No npm download was needed." -ForegroundColor Green
Write-Host "Desktop shortcut: $ShortcutPath"
Write-Host "Cashiers: double-click '$PosAppTitle'."
Write-Host ""
Read-Host "Press Enter to close"
