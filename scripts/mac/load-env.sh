#!/usr/bin/env bash
# Carga las variables del .env en la shell actual y muestra la identidad de AWS.
# Uso:  source ./scripts/mac/load-env.sh
set -a; source "$(dirname "${BASH_SOURCE[0]}")/../../.env"; set +a
export AWS_PROFILE="${AWS_PROFILE:-crediflow}"
echo "CF_STUDENT=$CF_STUDENT  CF_ENV=$CF_ENV  cuenta=$CDK_DEFAULT_ACCOUNT  región=$CDK_DEFAULT_REGION  perfil=$AWS_PROFILE"
aws sts get-caller-identity --output table 2>/dev/null || echo "⚠️  Sin sesión: ejecuta  aws login --profile $AWS_PROFILE"
