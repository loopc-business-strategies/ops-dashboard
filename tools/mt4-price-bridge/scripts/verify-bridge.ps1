# Verifies production MT4 bridge token + POST (uses Railway CLI).
# Usage: powershell -File tools/mt4-price-bridge/scripts/verify-bridge.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$backendDir = Resolve-Path (Join-Path $scriptDir '..\..\..\backend')
$verifyMjs = Join-Path $scriptDir 'verify-bridge.mjs'
Push-Location $backendDir

try {
  $json = railway variables --json | ConvertFrom-Json
  $token = [string]$json.METAL_RATES_BRIDGE_TOKEN
  if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'FAIL: METAL_RATES_BRIDGE_TOKEN not set on Railway' -ForegroundColor Red
    exit 1
  }
  Write-Host 'OK: METAL_RATES_BRIDGE_TOKEN is set on Railway' -ForegroundColor Green

  $env:BRIDGE_TOKEN = $token
  $result = & node $verifyMjs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: Bridge POST - $result" -ForegroundColor Red
    exit 1
  }
  $parsed = $result | ConvertFrom-Json
  if ($parsed.status -eq 200) {
    Write-Host 'OK: Bridge POST accepted (HTTP 200)' -ForegroundColor Green
    exit 0
  }
  Write-Host "FAIL: Bridge POST HTTP $($parsed.status) - $($parsed.body)" -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location
}
