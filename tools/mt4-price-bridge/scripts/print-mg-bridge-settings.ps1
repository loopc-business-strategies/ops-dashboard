# Prints MG MT4 bridge settings from Railway (run from repo root or backend/).
# Usage: powershell -File tools/mt4-price-bridge/scripts/print-mg-bridge-settings.ps1

$ErrorActionPreference = 'Stop'
$backendDir = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\backend')
Push-Location $backendDir

try {
  $json = railway variables --json | ConvertFrom-Json
  $token = [string]$json.METAL_RATES_BRIDGE_TOKEN
  if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Error 'METAL_RATES_BRIDGE_TOKEN is not set on Railway. Run: railway variables set METAL_RATES_BRIDGE_TOKEN=<long-random-secret>'
    exit 1
  }

  $bridgeUrl = 'https://api.loopcstrategies.com/api/erp-accounting/metal-rates/bridge'
  $webRequestOrigin = 'https://api.loopcstrategies.com'

  Write-Host ''
  Write-Host '=== MG MT4 bridge - production settings ===' -ForegroundColor Cyan
  Write-Host ''
  Write-Host '1) MT4 > Tools > Options > Expert Advisors'
  Write-Host '   [x] Allow automated trading'
  Write-Host '   [x] Allow WebRequest for listed URL'
  Write-Host "   Add URL: $webRequestOrigin"
  Write-Host ''
  Write-Host '2) Attach EquitiMetalPriceBridge to any chart, then set inputs:'
  Write-Host "   BridgeUrl=$bridgeUrl"
  Write-Host "   BridgeToken=$token"
  Write-Host '   Tenant=mg'
  Write-Host '   GoldSymbol=XAUUSD'
  Write-Host '   SilverSymbol=XAGUSD'
  Write-Host '   PlatinumSymbol=XPTUSD'
  Write-Host '   PostEverySeconds=1'
  Write-Host ''
  Write-Host '3) Enable AutoTrading (toolbar green button).'
  Write-Host ''
  Write-Host '4) Experts tab should show: MT4 metal bridge: posted Gold/Silver/Platinum ticks'
  Write-Host ''

  $setPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'mg-production.local.set'
  @(
    "BridgeUrl=$bridgeUrl"
    "BridgeToken=$token"
    'Tenant=mg'
    'GoldSymbol=XAUUSD'
    'SilverSymbol=XAGUSD'
    'PlatinumSymbol=XPTUSD'
    'PostEverySeconds=1'
    'RequestTimeoutMs=5000'
    'PrintSuccessfulPosts=1'
  ) | Set-Content -Path $setPath -Encoding UTF8

  Write-Host "Saved MT4 preset: $setPath" -ForegroundColor Green
  Write-Host 'In MT4: EA inputs > Load, pick mg-production.local.set'
  Write-Host ''
}
finally {
  Pop-Location
}
