param(
  [string]$ApiUrl = ""
)

$ErrorActionPreference = "Stop"
$PosRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $PosRoot ".env.local"
$ShopJson = Join-Path $PosRoot "src\data\shop.json"
$ShopShortName = "Al-rehman"
if (Test-Path $ShopJson) {
  try {
    $shop = Get-Content $ShopJson -Raw | ConvertFrom-Json
    if ($shop.shortName) { $ShopShortName = [string]$shop.shortName }
  } catch {
    # Keep default name if shop.json is unreadable.
  }
}
$PosAppTitle = "$ShopShortName POS"

function Stop-WithMessage([string]$Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "$PosAppTitle - local production setup" -ForegroundColor Cyan
Write-Host "This is a one-time owner/developer setup. Cashiers will not run it."
Write-Host ""

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Stop-WithMessage "Node.js 20+ is required on this PC. Install the LTS version from https://nodejs.org and run setup again."
}

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) {
  Stop-WithMessage "Node.js 20+ is required. The installed version is $(node --version)."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Stop-WithMessage "npm was not found. Reinstall Node.js LTS and run setup again."
}

$savedApiUrl = ""
if (-not $ApiUrl -and (Test-Path $EnvFile)) {
  $existing = Get-Content $EnvFile |
    Where-Object { $_ -match "^NEXT_PUBLIC_API_URL=" } |
    Select-Object -First 1
  if ($existing) {
    $savedApiUrl = ($existing -replace "^NEXT_PUBLIC_API_URL=", "").Trim()
  }
}

if (-not $ApiUrl) {
  if ($savedApiUrl -and $savedApiUrl -notmatch "localhost|127\.0\.0\.1") {
    Write-Host "Saved cloud API URL:" -ForegroundColor Yellow
    Write-Host "  $savedApiUrl"
    Write-Host "Press Enter to keep it, or paste a new URL (must end with /api/v1)."
    $typed = (Read-Host "Cloud API URL").Trim()
    $ApiUrl = if ($typed) { $typed } else { $savedApiUrl }
  } else {
    Write-Host "Enter the deployed cloud API URL used by the live POS." -ForegroundColor Yellow
    Write-Host "Example: https://your-api.onrender.com/api/v1"
    $ApiUrl = (Read-Host "Cloud API URL").Trim()
  }
}

if (-not [Uri]::IsWellFormedUriString($ApiUrl, [UriKind]::Absolute)) {
  Stop-WithMessage "The API URL is not valid. Run setup again with the full https://.../api/v1 URL."
}

if ($ApiUrl -notmatch "/api/v1/?$") {
  Stop-WithMessage "The API URL must end with /api/v1 (example: https://your-api.onrender.com/api/v1)."
}

$ApiUrl = $ApiUrl.TrimEnd("/")
$envLines = @()
if (Test-Path $EnvFile) {
  $envLines = @(Get-Content $EnvFile | Where-Object {
    $_ -notmatch "^NEXT_PUBLIC_API_URL="
  })
}
$envLines = @("NEXT_PUBLIC_API_URL=$ApiUrl") + $envLines
# Next.js reads .env as plain UTF-8; a BOM would corrupt the first key name.
[System.IO.File]::WriteAllLines(
  $EnvFile,
  $envLines,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "Checking cloud API..." -ForegroundColor Cyan
Write-Host "A free Render service can take up to a minute to wake up."
$apiReachable = $false
foreach ($attempt in 1..3) {
  try {
    Invoke-WebRequest `
      -Uri "$ApiUrl/settings/public" `
      -UseBasicParsing `
      -TimeoutSec 45 | Out-Null
    $apiReachable = $true
    break
  } catch {
    Write-Host "Attempt $attempt of 3 failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

if ($apiReachable) {
  Write-Host "Cloud API is reachable." -ForegroundColor Green
} else {
  Write-Host "Warning: API check failed. The build can continue, but first login/sync will require the correct URL and internet." -ForegroundColor Yellow
  Write-Host "Type y to continue, or anything else to stop and re-check the URL."
  $continue = Read-Host "Continue building? (y/N)"
  if ($continue -notmatch "^[Yy]$") {
    exit 1
  }
}

# A running local POS server keeps next-swc loaded, which makes dependency
# installs fail on Windows with EPERM.
$listeners = @(
  Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
)
if ($listeners.Count -gt 0) {
  Write-Host ""
  Write-Host "Stopping the running local POS server before installing..." -ForegroundColor Cyan
  foreach ($processId in $listeners) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

$LockFile = Join-Path $PosRoot "package-lock.json"
$ModulesDir = Join-Path $PosRoot "node_modules"
$StampFile = Join-Path $ModulesDir ".krunchies-install-stamp"
$LockHash = (Get-FileHash -Path $LockFile -Algorithm SHA256).Hash
$InstalledHash = if (Test-Path $StampFile) { (Get-Content $StampFile -Raw).Trim() } else { "" }

Push-Location $PosRoot
try {
  Write-Host ""
  if ((Test-Path $ModulesDir) -and $InstalledHash -eq $LockHash) {
    Write-Host "Dependencies already match package-lock.json - skipping install." -ForegroundColor Green
  } else {
    Write-Host "Installing locked dependencies..." -ForegroundColor Cyan
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) {
      Stop-WithMessage "Dependency install failed. Close every POS/Chrome window, pause antivirus scanning of this folder, then run setup again."
    }
    Set-Content -Path $StampFile -Value $LockHash -Encoding ASCII
  }

  Write-Host ""
  Write-Host "Building the production POS..." -ForegroundColor Cyan
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Production build failed. Review the error above."
  }
} finally {
  Pop-Location
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

# Remove old brand shortcut so cashiers are not confused after rebrand.
$LegacyShortcut = Join-Path $Desktop "Krunchies POS.lnk"
if ((Test-Path $LegacyShortcut) -and ($LegacyShortcut -ne $ShortcutPath)) {
  Remove-Item $LegacyShortcut -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Local POS is ready." -ForegroundColor Green
Write-Host "Desktop shortcut: $ShortcutPath"
Write-Host "Cashiers only need to double-click '$PosAppTitle'."
Write-Host ""
Read-Host "Press Enter to close"
