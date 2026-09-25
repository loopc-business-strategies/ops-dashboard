# Stop development servers gracefully
# Usage: powershell -File .\stop-dev.ps1
# Prefer stopping with Ctrl+C in the terminal that runs `npm run dev`.

Write-Host "`nStopping development servers...`n" -ForegroundColor Cyan

# Stop processes listening on ports 5173 (frontend) and 5000 (backend)
$ports = @(5173, 5000)
$portNames = @{ 5173 = "Frontend (Vite)"; 5000 = "Backend (Express)" }

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    
    if ($connection) {
        $process = Get-Process -PID $connection.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  - Stopping $($portNames[$port]) on port $port (PID: $($process.Id))..." -ForegroundColor Yellow
            Stop-Process -ID $process.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
            Write-Host "    Stopped" -ForegroundColor Green
        }
    } else {
        Write-Host "  - Port $port ($($portNames[$port])) not in use" -ForegroundColor Gray
    }
}

Write-Host "`nShutdown complete`n" -ForegroundColor Green
