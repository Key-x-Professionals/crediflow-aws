#!/usr/bin/env bash
# Genera apps/web/.env.local con las URLs del backend del alumno leyendo SSM Parameter Store.
# Uso: ./scripts/mac/web-env.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a

PREFIX="/crediflow/${CF_STUDENT}/${CF_ENV}"
get() { aws ssm get-parameter --name "${PREFIX}/$1" --query 'Parameter.Value' --output text 2>/dev/null || echo ""; }

API_URL=$(get api-url)
PRECAL_URL=$(get precal-url)
POOL_ID=$(get user-pool-id)
CLIENT_ID=$(get user-pool-client-id)

cat > apps/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=${API_URL:-http://localhost:3000}
NEXT_PUBLIC_PRECAL_URL=${PRECAL_URL}
NEXT_PUBLIC_AWS_REGION=${CDK_DEFAULT_REGION:-us-east-1}
NEXT_PUBLIC_COGNITO_USER_POOL_ID=${POOL_ID}
NEXT_PUBLIC_COGNITO_CLIENT_ID=${CLIENT_ID}
NEXT_PUBLIC_STUDENT=${CF_STUDENT}
EOF

echo "✅ apps/web/.env.local generado:"
cat apps/web/.env.local
