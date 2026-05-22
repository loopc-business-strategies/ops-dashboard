$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path '.env')) {
  Write-Host 'Missing .env file.' -ForegroundColor Yellow
  Write-Host 'Creating .env from .env.example. Edit METAL_RATES_BRIDGE_TOKEN before running again.' -ForegroundColor Yellow
  Copy-Item '.env.example' '.env'
  notepad '.env'
  exit 1
}

$pythonCommand = $null
$pythonArgs = @()

$py = Get-Command 'py' -ErrorAction SilentlyContinue
if ($py) {
  & py -3 --version *> $null
  if ($LASTEXITCODE -eq 0) {
    $pythonCommand = 'py'
    $pythonArgs = @('-3')
  }
}

if (-not $pythonCommand) {
  $python = Get-Command 'python' -ErrorAction SilentlyContinue
  if ($python -and $python.Source -notmatch '\\Microsoft\\WindowsApps\\python\.exe$') {
    $versionOutput = & python --version 2>&1
    if ($LASTEXITCODE -eq 0 -and ($versionOutput -join ' ') -match 'Python\s+3\.') {
      $pythonCommand = 'python'
      $pythonArgs = @()
    }
  }
}

if (-not $pythonCommand) {
  $localPython = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
  if (Test-Path $localPython) {
    $versionOutput = & $localPython --version 2>&1
    if ($LASTEXITCODE -eq 0 -and ($versionOutput -join ' ') -match 'Python\s+3\.') {
      $pythonCommand = $localPython
      $pythonArgs = @()
    }
  }
}

if (-not $pythonCommand) {
  Write-Host 'Python was not found on PATH. Install Python 3 first, then run this again.' -ForegroundColor Red
  exit 1
}

$existingTerminalPath = [Environment]::GetEnvironmentVariable('MT5_TERMINAL_PATH', 'Process')
if (-not $existingTerminalPath) {
  $runningTerminal = Get-Process -Name 'terminal64' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path } |
    Select-Object -First 1

  if ($runningTerminal -and $runningTerminal.Path) {
    $env:MT5_TERMINAL_PATH = $runningTerminal.Path
    Write-Host "Using running MT5 terminal: $($runningTerminal.Path)" -ForegroundColor Cyan
  }
}

Write-Host 'Installing/updating bridge Python package...' -ForegroundColor Cyan
& $pythonCommand @pythonArgs -m pip install -r requirements.txt
Write-Host 'Starting MT5 live price bridge...' -ForegroundColor Green
& $pythonCommand @pythonArgs mt5_price_bridge.py
