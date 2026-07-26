$Host.UI.RawUI.WindowTitle = "GIACONG UI - PREVIEW"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

chcp 65001 | Out-Null
Set-Location -LiteralPath "C:\Users\hieuk\Desktop\giacong-ui-standalone"

$env:ALLOW_DEMO_CATALOG = "1"
$env:CATALOG_DEMO_FALLBACK = "1"
$env:BAGISTO_API_URL = "http://127.0.0.1:19999"

Start-Transcript -LiteralPath "C:\Users\hieuk\Desktop\giacong-ui-logs\05-preview-server.log" -Append
Write-Host "Đang chạy giao diện tại http://localhost:4310" -ForegroundColor Green
npm run dev -- -p 4310
Write-Host "Server đã dừng với mã $LASTEXITCODE" -ForegroundColor Yellow
Stop-Transcript
