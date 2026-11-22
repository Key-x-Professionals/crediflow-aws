#!/usr/bin/env bash
# Carga las variables del .env en la shell actual y muestra la identidad de AWS.
# Uso:  source ./scripts/mac/load-env.sh
set -a; source "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../.." && pwd)/.env"; set +a

# Normaliza CF_STUDENT igual que infra/lib/config.ts: puntos/símbolos a guion y
# recorte a 14 caracteres cortando en el último guion (para que el stack no se pase de largo).
_cf_raw="$CF_STUDENT"
_cf="$(printf '%s' "$CF_STUDENT" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')"
if [ "${#_cf}" -gt 14 ]; then _cf="${_cf:0:14}"; _cf="${_cf%-}"; case "$_cf" in *-*) _cf="${_cf%-*}";; esac; fi
export CF_STUDENT="$_cf"
[ "$_cf_raw" != "$_cf" ] && echo "ℹ️  CF_STUDENT normalizado: \"$_cf_raw\" → \"$_cf\""
unset _cf_raw _cf

export CLUSTER="crediflow-$CF_STUDENT-${CF_ENV:-dev}-api-cluster"
export SERVICIO="crediflow-$CF_STUDENT-${CF_ENV:-dev}-api"

export AWS_PROFILE="${AWS_PROFILE:-crediflow}"
echo "CF_STUDENT=$CF_STUDENT  CF_ENV=$CF_ENV  cuenta=$CDK_DEFAULT_ACCOUNT  región=$CDK_DEFAULT_REGION  perfil=$AWS_PROFILE"
aws sts get-caller-identity --output table 2>/dev/null || echo "⚠️  Sin sesión: ejecuta  aws login --profile $AWS_PROFILE"
