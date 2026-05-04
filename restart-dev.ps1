$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $repoRoot 'frontend'
$backendPath = Join-Path $repoRoot 'backend'
$ports = 5173, 5174, 5000

Write-Host 'Clearing stale Node listeners on ports 5173, 5174 and 5000...' -ForegroundColor Cyan

$listenerPids = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($procId in $listenerPids) {
  $process = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq 'node') {
    Write-Host "Stopping Node PID $procId" -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host 'Starting backend dev server...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$backendPath'; npm run dev"

Write-Host 'Starting frontend dev server on port 5173...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$frontendPath'; npm run dev -- --host 0.0.0.0 --port 5173"

Write-Host ''
Write-Host 'Dev servers launched.' -ForegroundColor Green
Write-Host 'Backend:  http://localhost:5000' -ForegroundColor Green
Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Green
