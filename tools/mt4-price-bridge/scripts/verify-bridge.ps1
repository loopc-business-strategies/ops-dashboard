# Verifies production MT4 bridge token + POST (uses Railway CLI).
# Usage: powershell -File tools/mt4-price-bridge/scripts/verify-bridge.ps1

$ErrorActionPreference = 'Stop'
$backendDir = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\backend')
Push-Location $backendDir

try {
  $json = railway variables --json | ConvertFrom-Json
  $token = [string]$json.METAL_RATES_BRIDGE_TOKEN
  if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'FAIL: METAL_RATES_BRIDGE_TOKEN not set on Railway' -ForegroundColor Red
    exit 1
  }
  Write-Host 'OK: METAL_RATES_BRIDGE_TOKEN is set on Railway' -ForegroundColor Green

  $nodeScript = @'
const https = require('https');
const token = process.env.BRIDGE_TOKEN;
const body = JSON.stringify({
  source: 'mt4-bridge',
  tenant: 'mg',
  currency: 'USD',
  unit: 'TOZ',
  metals: {
    gold: { mid: 2650.5, bid: 2650, ask: 2651 },
    silver: { mid: 31.2, bid: 31.1, ask: 31.3 },
    platinum: { mid: 980.5, bid: 980, ask: 981 },
  },
});
const req = https.request({
  hostname: 'api.loopcstrategies.com',
  path: '/api/erp-accounting/metal-rates/bridge',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-metal-rates-bridge-token': token,
    'x-tenant': 'mg',
  },
}, (res) => {
  let data = '';
  res.on('data', (c) => { data += c; });
  res.on('end', () => {
    console.log(JSON.stringify({ status: res.statusCode, body: data }));
    process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1);
  });
});
req.on('error', (e) => { console.error(e.message); process.exit(1); });
req.write(body);
req.end();
'@

  $env:BRIDGE_TOKEN = $token
  $result = $nodeScript | node
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
