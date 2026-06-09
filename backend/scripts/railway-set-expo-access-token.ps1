# Sets EXPO_ACCESS_TOKEN on the linked Railway service (ops-dashboard) for Expo push delivery.
#
# Prereqs:
#   1. `railway login` and link this repo to the project (same as `railway status`).
#   2. Create an Expo access token: https://expo.dev/accounts/<your-account>/settings/access-tokens
#
# Usage (PowerShell — do NOT commit the token):
#   $env:EXPO_ACCESS_TOKEN = 'your_expo_token_here'
#   .\backend\scripts\railway-set-expo-access-token.ps1
#
# Optional: override service name if yours differs:
#   $env:RAILWAY_SERVICE_NAME = 'ops-dashboard'

$ErrorActionPreference = 'Stop'
$service = if ($env:RAILWAY_SERVICE_NAME) { $env:RAILWAY_SERVICE_NAME } else { 'ops-dashboard' }
$token = [string]$env:EXPO_ACCESS_TOKEN
if (-not $token.Trim()) {
  Write-Error 'Set EXPO_ACCESS_TOKEN in the environment first (Expo dashboard → Access tokens).'
}

Write-Host "Setting EXPO_ACCESS_TOKEN on Railway service: $service (value not printed)..."
$token | railway variable set EXPO_ACCESS_TOKEN --stdin --service $service
Write-Host 'Done. Railway will redeploy; confirm under Deployments and test mobile push.'
