#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
$cli = Join-Path $root "packages\cli\dist\bin.js"

if (-not (Test-Path -LiteralPath $cli)) {
  Write-Error "Cannot find packages\cli\dist\bin.js. Run npm run build before using scripts\azi.ps1."
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
  Write-Error "Cannot find node in PATH. Install Node.js or run the CLI from an environment that provides node."
}

& $nodeCommand.Source $cli @args
exit $LASTEXITCODE
