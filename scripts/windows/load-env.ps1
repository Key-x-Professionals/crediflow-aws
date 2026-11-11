# Carga las variables del .env en la sesión actual de PowerShell y muestra la identidad de AWS.
# Uso:  . .\scripts\windows\load-env.ps1
$root = Join-Path $PSScriptRoot "..\.."
Get-Content (Join-Path $root ".env") | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
  $k, $v = $_ -split "=", 2
  Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}
if (-not $env:AWS_PROFILE) { $env:AWS_PROFILE = "crediflow" }
Write-Host "CF_STUDENT=$env:CF_STUDENT  CF_ENV=$env:CF_ENV  cuenta=$env:CDK_DEFAULT_ACCOUNT  región=$env:CDK_DEFAULT_REGION  perfil=$env:AWS_PROFILE"
try { aws sts get-caller-identity --output table } catch { Write-Host "⚠️  Sin sesión: ejecuta  aws login --profile $env:AWS_PROFILE" }
