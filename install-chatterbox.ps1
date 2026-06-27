$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Join-Path $Root "local-tts\chatterbox"
$PythonExe = Join-Path $InstallDir "Scripts\python.exe"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python is required for free local voice cloning. Install Python 3.10 or newer, then rerun this script."
}

if (-not (Test-Path $PythonExe)) {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  python -m venv $InstallDir
}

& $PythonExe -m pip install --upgrade pip
& $PythonExe -m pip install chatterbox-tts

Write-Host ""
Write-Host "Chatterbox local voice cloning is installed."
Write-Host "Restart ECHO Studios, upload a voice reference, choose Local Clone, then generate an audio sample."
