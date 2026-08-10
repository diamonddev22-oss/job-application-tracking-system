# Runs MinIO natively on Windows (no Docker), with credentials/bucket matching the repo's .env /
# backend defaults exactly - a drop-in replacement for `docker compose up -d minio` plus the
# one-time `minio-init` bucket setup. Exists because Docker Desktop can fail to start at all while
# Astrill VPN is connected (see README.md's "Troubleshooting: VPN interference" section) - the same
# reason the backend no longer depends on the JVM.
#
# One-time setup (binaries aren't committed - see .gitignore):
#   curl.exe -L -o minio-native\minio.exe https://dl.min.io/server/minio/release/windows-amd64/minio.exe
#   curl.exe -L -o minio-native\mc.exe    https://dl.min.io/client/mc/release/windows-amd64/mc.exe
#
# Usage (run from the repo root, in its own terminal - this is the long-running server process):
#   powershell -File scripts\start-minio-native.ps1
#
# The very first time, also create the bucket in a second terminal while this is running:
#   minio-native\mc.exe alias set localminio http://127.0.0.1:9000 jats_minio jats_minio_password
#   minio-native\mc.exe mb --ignore-existing localminio/resumes
#   minio-native\mc.exe anonymous set download localminio/resumes

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MinioDir = Join-Path $RepoRoot "minio-native"
$MinioExe = Join-Path $MinioDir "minio.exe"

if (-not (Test-Path $MinioExe)) {
    Write-Error "minio.exe not found at $MinioExe - see the download commands in this script's header comment."
    exit 1
}

$env:MINIO_ROOT_USER = "jats_minio"
$env:MINIO_ROOT_PASSWORD = "jats_minio_password"
$env:MINIO_API_CORS_ALLOW_ORIGIN = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"

New-Item -ItemType Directory -Force -Path (Join-Path $MinioDir "data") | Out-Null

Write-Host "Starting MinIO natively on http://127.0.0.1:9000 (console: http://127.0.0.1:9001) ..."
& $MinioExe server (Join-Path $MinioDir "data") --console-address ":9001"
