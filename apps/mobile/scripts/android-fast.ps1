$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path -Parent $PSScriptRoot
$workspaceDrive = [System.IO.Path]::GetPathRoot($mobileRoot)
$buildRoot = Join-Path $workspaceDrive ".dike-build"

$env:GRADLE_USER_HOME = Join-Path $buildRoot "gradle"
$env:TEMP = Join-Path $buildRoot "temp"
$env:TMP = $env:TEMP
$env:DIKE_CXX_STAGING_DIR = Join-Path $buildRoot "cxx\mobile-app"

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
New-Item -ItemType Directory -Force -Path $env:DIKE_CXX_STAGING_DIR | Out-Null

Write-Host "Gradle cache: $env:GRADLE_USER_HOME"
Write-Host "Build temp:   $env:TEMP"
Write-Host "CMake output: $env:DIKE_CXX_STAGING_DIR"

Push-Location $mobileRoot
try {
  & pnpm exec expo run:android @args
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}
