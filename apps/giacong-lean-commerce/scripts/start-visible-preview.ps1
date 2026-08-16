$ErrorActionPreference = "Stop"

if (-not $env:COMMERCE_PREVIEW_PORT) {
  $env:COMMERCE_PREVIEW_PORT = "4310"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $env:TEMP "giacong-commerce-preview.log"

Push-Location $projectRoot
try {
  & pnpm exec next dev -H 0.0.0.0 -p $env:COMMERCE_PREVIEW_PORT 2>&1 |
    Tee-Object -FilePath $logPath
  if ($LASTEXITCODE -ne 0) {
    throw "Preview server exited with code $LASTEXITCODE. See $logPath."
  }
} finally {
  Pop-Location
}