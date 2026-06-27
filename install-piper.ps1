$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$TtsRoot = Join-Path $Root "local-tts"
$PiperDir = Join-Path $TtsRoot "piper"
$VoiceDir = Join-Path $TtsRoot "voices"
$TempDir = Join-Path $TtsRoot "_download"

$PiperZipUrl = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
$Voices = @(
  @{
    Name = "en_US-lessac-medium"
    Model = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
    Config = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"
  },
  @{
    Name = "en_US-ryan-medium"
    Model = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx"
    Config = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json"
  },
  @{
    Name = "en_US-amy-medium"
    Model = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx"
    Config = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json"
  }
)

New-Item -ItemType Directory -Force -Path $PiperDir, $VoiceDir, $TempDir | Out-Null

$PiperExe = Join-Path $PiperDir "piper.exe"
if (-not (Test-Path -LiteralPath $PiperExe)) {
  $ZipPath = Join-Path $TempDir "piper_windows_amd64.zip"
  Write-Host "Downloading Piper..."
  Invoke-WebRequest -Uri $PiperZipUrl -OutFile $ZipPath

  $ExtractDir = Join-Path $TempDir "piper_extract"
  if (Test-Path -LiteralPath $ExtractDir) {
    Remove-Item -LiteralPath $ExtractDir -Recurse -Force
  }
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractDir -Force

  $ExtractedExe = Get-ChildItem -Path $ExtractDir -Recurse -Filter "piper.exe" | Select-Object -First 1
  if (-not $ExtractedExe) {
    throw "Could not find piper.exe inside downloaded archive."
  }

  Copy-Item -Path (Join-Path $ExtractedExe.DirectoryName "*") -Destination $PiperDir -Recurse -Force
}

foreach ($Voice in $Voices) {
  $ModelPath = Join-Path $VoiceDir "$($Voice.Name).onnx"
  $ConfigPath = Join-Path $VoiceDir "$($Voice.Name).onnx.json"

  if (-not (Test-Path -LiteralPath $ModelPath)) {
    Write-Host "Downloading $($Voice.Name) model..."
    Invoke-WebRequest -Uri $Voice.Model -OutFile $ModelPath
  }

  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Write-Host "Downloading $($Voice.Name) config..."
    Invoke-WebRequest -Uri $Voice.Config -OutFile $ConfigPath
  }
}

Write-Host "Piper installed:"
Write-Host "  $PiperExe"
Write-Host "Voices installed:"
Get-ChildItem -LiteralPath $VoiceDir -Filter "*.onnx" | ForEach-Object {
  Write-Host "  $($_.FullName)"
}
