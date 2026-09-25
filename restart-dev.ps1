# Prefer: npm run dev  (uses scripts/dev-orchestrator.js)
# This wrapper only forwards to the Node orchestrator — no nested PowerShell spawn.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot
Write-Host 'Starting dev via npm run dev...' -ForegroundColor Cyan
npm run dev
