param(
  [int]$Port = 0
)

$Host.UI.RawUI.WindowTitle = "GIACONG UI - PREVIEW"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

chcp 65001 | Out-Null

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$configuredPort = 0
if ($env:COMMERCE_PREVIEW_PORT) {
  [void][int]::TryParse($env:COMMERCE_PREVIEW_PORT, [ref]$configuredPort)
}
$previewPort = if ($Port -gt 0) { $Port } elseif ($configuredPort -gt 0) { $configuredPort } else { 4310 }
$logDirectory = Join-Path $env:TEMP "giacong-ui-logs"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory "preview-server.log"

Set-Location -LiteralPath $projectRoot
Start-Transcript -LiteralPath $logPath -Append
Write-Host "Đang chạy giao diện tại http://localhost:$previewPort" -ForegroundColor Green
npm run dev -- -p $previewPort
Write-Host "Server đã dừng với mã $LASTEXITCODE" -ForegroundColor Yellow
Stop-Transcript
