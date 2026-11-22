# Genera apps/web/.env.local con las URLs del backend del alumno leyendo SSM Parameter Store.
# Uso: .\scripts\windows\web-env.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")

Get-Content .env | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
  $k, $v = $_ -split "=", 2
  Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}

$prefix = "/crediflow/$env:CF_STUDENT/$env:CF_ENV"
function Get-Param($name) {
  try { aws ssm get-parameter --name "$prefix/$name" --query 'Parameter.Value' --output text 2>$null } catch { "" }
}

$apiUrl = Get-Param "api-url"
if (-not $apiUrl) { $apiUrl = "http://localhost:3000" }
$region = if ($env:CDK_DEFAULT_REGION) { $env:CDK_DEFAULT_REGION } else { "us-east-1" }

@"
NEXT_PUBLIC_API_URL=$apiUrl
NEXT_PUBLIC_PRECAL_URL=$(Get-Param "precal-url")
NEXT_PUBLIC_AWS_REGION=$region
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$(Get-Param "user-pool-id")
NEXT_PUBLIC_COGNITO_CLIENT_ID=$(Get-Param "user-pool-client-id")
NEXT_PUBLIC_STUDENT=$env:CF_STUDENT
"@ | Set-Content -Path apps\web\.env.local -Encoding utf8

Write-Host "✅ apps/web/.env.local generado:"
Get-Content apps\web\.env.local
