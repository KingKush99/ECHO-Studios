$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Join-Path $Root "local-tts\chatterbox"
$PythonExe = Join-Path $InstallDir "Scripts\python.exe"
$PackageTempDir = Join-Path $Root "local-tts\.package-temp"
# Managed Python cannot be atomically renamed on some mapped drives. Keep the
# reusable interpreter and package cache local while the venv stays here.
$UvCacheDir = Join-Path $env:LOCALAPPDATA "ECHO-Studios\uv-cache"
$UvPythonDir = Join-Path $env:LOCALAPPDATA "ECHO-Studios\uv-python"

$Uv = Get-Command uv -ErrorAction SilentlyContinue

if ($Uv) {
  $env:UV_CACHE_DIR = $UvCacheDir
  $env:UV_PYTHON_INSTALL_DIR = $UvPythonDir

  function Invoke-Uv {
    & $Uv.Source @args
    if ($LASTEXITCODE -ne 0) {
      throw "uv failed with exit code $LASTEXITCODE."
    }
  }

  if (-not (Test-Path $PythonExe)) {
    Invoke-Uv venv --python 3.11 $InstallDir
  }

} else {
  $SystemPython = Get-Command python -ErrorAction SilentlyContinue
  if (-not $SystemPython) {
    throw "Python 3.11 or uv is required for free local HD voices. Install uv, then rerun this script."
  }

  & $SystemPython.Source -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)"
  if ($LASTEXITCODE -ne 0) {
    throw "Chatterbox requires Python 3.11 on this setup. Install uv, then rerun this script so ECHO can manage Python locally."
  }

  if (-not (Test-Path $PythonExe)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    & $SystemPython.Source -m venv $InstallDir
  }

}

function Invoke-ChatterboxPython {
  & $PythonExe @args
  if ($LASTEXITCODE -ne 0) {
    throw "Python package installation failed with exit code $LASTEXITCODE."
  }
}

New-Item -ItemType Directory -Force -Path $PackageTempDir | Out-Null
$PreviousTemp = $env:TEMP
$PreviousTmp = $env:TMP
$env:TEMP = $PackageTempDir
$env:TMP = $PackageTempDir

try {
  Invoke-ChatterboxPython -m ensurepip --upgrade
  Invoke-ChatterboxPython -m pip install --disable-pip-version-check --no-cache-dir --upgrade pip

  # Pin CPU PyTorch on machines without NVIDIA CUDA so the local install stays smaller.
  if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
    Invoke-ChatterboxPython -m pip install --disable-pip-version-check --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.6.0 torchaudio==2.6.0
  }

  Invoke-ChatterboxPython -m pip install --disable-pip-version-check --no-cache-dir chatterbox-tts==0.1.7
  Invoke-ChatterboxPython -c "from chatterbox.tts import ChatterboxTTS; print('Chatterbox import verified.')"
} finally {
  $env:TEMP = $PreviousTemp
  $env:TMP = $PreviousTmp
  Remove-Item -LiteralPath $PackageTempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Chatterbox HD local voices are installed."
Write-Host "Restart ECHO Studios, choose Chatterbox HD, then generate audio. Voice references are optional."
