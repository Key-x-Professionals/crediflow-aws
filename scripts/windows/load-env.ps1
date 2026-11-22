# Carga las variables del .env en la sesión actual de PowerShell y muestra la identidad de AWS.
# Uso:  . .\scripts\windows\load-env.ps1
$root = Join-Path $PSScriptRoot "..\.."
Get-Content (Join-Path $root ".env") | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
  $k, $v = $_ -split "=", 2
  Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}
# Normaliza CF_STUDENT igual que infra/lib/config.ts: puntos/símbolos a guion y
# recorte a 14 caracteres cortando en el último guion (para que el stack no se pase de largo).
$cfRaw = $env:CF_STUDENT
$cf = $cfRaw.ToLower() -replace '[^a-z0-9-]+','-' -replace '-+','-' -replace '^-+|-+$',''
if ($cf.Length -gt 14) {
  $cf = ($cf.Substring(0,14)) -replace '-+$',''
  if ($cf.Contains('-')) { $cf = $cf -replace '-[^-]*$','' }
}
$env:CF_STUDENT = $cf
if ($cfRaw -ne $cf) { Write-Host "ℹ️  CF_STUDENT normalizado: `"$cfRaw`" -> `"$cf`"" }

if (-not $env:AWS_PROFILE) { $env:AWS_PROFILE = "crediflow" }
Write-Host "CF_STUDENT=$env:CF_STUDENT  CF_ENV=$env:CF_ENV  cuenta=$env:CDK_DEFAULT_ACCOUNT  región=$env:CDK_DEFAULT_REGION  perfil=$env:AWS_PROFILE"
try { aws sts get-caller-identity --output table } catch { Write-Host "⚠️  Sin sesión: ejecuta  aws login --profile $env:AWS_PROFILE" }
