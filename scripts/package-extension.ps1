# Builds the Chrome extension and zips it into frontend/public/downloads, where the frontend's
# "Get the extension" page links to it as a static file. Not run automatically as part of the
# frontend build - the extension changes far less often, and zipping on every frontend rebuild
# would be wasted work - so re-run this manually after any chrome-extension change that should be
# reflected in the downloadable zip.
#
# The backend URL is baked into the extension at *build* time (see chrome-extension/src/api/client.ts)
# and is never user-editable at runtime - so unlike the frontend (which auto-detects the right host
# from window.location - see frontend/src/api/client.ts), this zip needs to be told explicitly what
# host to point at, because whoever downloads and installs it will very likely be on a *different*
# computer than the one it's built on. Defaulting this to plain "localhost" would silently produce
# an extension that only works on the machine that ran this script - pass -ApiBaseUrl pointing at
# this machine's actual LAN IP (find it with `ipconfig`, look for the adapter you connect through -
# not a VPN/virtual one) for it to also work for anyone else on the same network.
#
# Usage (from the repo root):
#   powershell -File scripts\package-extension.ps1 -ApiBaseUrl http://192.168.1.23:8080/api

param(
    [string]$ApiBaseUrl = "http://localhost:8080/api"
)

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ExtensionDir = Join-Path $RepoRoot "chrome-extension"
$DistDir = Join-Path $ExtensionDir "dist"
$DownloadsDir = Join-Path $RepoRoot "frontend\public\downloads"
$ZipPath = Join-Path $DownloadsDir "jats-chrome-extension.zip"

if ($ApiBaseUrl -match "^https?://(localhost|127\.0\.0\.1)([:/]|$)") {
    Write-Warning "Packaging with API base URL '$ApiBaseUrl' - this will only work when installed on THIS machine. Pass -ApiBaseUrl with this machine's LAN IP so it also works for other devices."
}

Write-Host "Building chrome-extension (VITE_API_BASE_URL=$ApiBaseUrl)..."
Push-Location $ExtensionDir
try {
    $env:VITE_API_BASE_URL = $ApiBaseUrl
    npm run build
    $exitCode = $LASTEXITCODE
    Remove-Item Env:\VITE_API_BASE_URL
    if ($exitCode -ne 0) {
        throw "chrome-extension build failed with exit code $exitCode"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $DistDir)) {
    throw "Build did not produce $DistDir"
}

New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

Write-Host "Zipping $DistDir -> $ZipPath ..."
Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ZipPath

Write-Host "Done: $ZipPath"
