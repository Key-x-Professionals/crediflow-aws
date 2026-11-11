#!/bin/bash
# User data de la instancia EC2 (sesión 2). Amazon Linux 2023.
# Instala Node.js, descarga la API desde S3, la compila y la deja como servicio systemd.
# Las variables __BUCKET__, __DB_SECRET__ y __REGION__ las reemplaza el script de despliegue.
set -euxo pipefail
exec > /var/log/crediflow-user-data.log 2>&1

dnf install -y nodejs22 npm unzip jq
mkdir -p /opt/crediflow && cd /opt/crediflow

aws s3 cp s3://__BUCKET__/releases/api.zip ./api.zip --region __REGION__
unzip -o api.zip -d api && cd api
npm install --no-audit --no-fund
npm run build
npm prune --omit=dev

# Credenciales de la base de datos desde Secrets Manager (nunca en texto plano en el disco)
SECRET=$(aws secretsmanager get-secret-value --secret-id "__DB_SECRET__" --region __REGION__ --query SecretString --output text)
cat > /etc/crediflow.env <<EOF
PORT=80
STORAGE=postgres
DB_HOST=$(echo "$SECRET" | jq -r .host)
DB_PORT=$(echo "$SECRET" | jq -r .port)
DB_NAME=$(echo "$SECRET" | jq -r .dbname)
DB_USER=$(echo "$SECRET" | jq -r .username)
DB_PASSWORD=$(echo "$SECRET" | jq -r .password)
DOCUMENTS_BUCKET=__BUCKET__
AWS_REGION=__REGION__
CF_STUDENT=__STUDENT__
CF_ENV=manual
EOF
chmod 600 /etc/crediflow.env

cat > /etc/systemd/system/crediflow-api.service <<'EOF'
[Unit]
Description=CrediFlow API (despliegue manual, sesion 2)
After=network.target

[Service]
EnvironmentFile=/etc/crediflow.env
WorkingDirectory=/opt/crediflow/api
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now crediflow-api
sleep 3
curl -s http://127.0.0.1/health || true
