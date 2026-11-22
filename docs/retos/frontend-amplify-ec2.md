# Reto extra · Desplegar el frontend de CrediFlow (Amplify Hosting o EC2)

*Opcional. No afecta el proyecto. Se puede hacer desde la sesión 4 (cuando ya existe la API en el ALB).*

El frontend (`apps/web`) es Next.js y solo necesita variables `NEXT_PUBLIC_*` en el momento del **build**. Dos caminos:

---

## Opción A · AWS Amplify Hosting (recomendada: 15 min, CI/CD incluido)

Amplify construye y publica el sitio desde tu repositorio de GitHub en cada push.

1. Genera las variables con `./scripts/mac/web-env.sh` (o `.ps1`) y anótalas.
2. Crea la app por CLI (o por consola → *Amplify → New app → GitHub*):

```bash
aws amplify create-app --name crediflow-web-$CF_STUDENT --repository https://github.com/<usuario>/crediflow \
  --access-token <token-de-github-con-scope-repo> --platform WEB_COMPUTE \
  --environment-variables NEXT_PUBLIC_API_URL=<api-url>,NEXT_PUBLIC_PRECAL_URL=<precal-url>,NEXT_PUBLIC_AWS_REGION=us-east-1,NEXT_PUBLIC_COGNITO_USER_POOL_ID=<pool>,NEXT_PUBLIC_COGNITO_CLIENT_ID=<client>,NEXT_PUBLIC_STUDENT=$CF_STUDENT,AMPLIFY_MONOREPO_APP_ROOT=apps/web \
  --build-spec file://docs/retos/amplify.yml
APP_ID=$(aws amplify list-apps --query "apps[?name=='crediflow-web-$CF_STUDENT'].appId" --output text)
aws amplify create-branch --app-id $APP_ID --branch-name main --framework "Next.js - SSR" --stage PRODUCTION
aws amplify start-job --app-id $APP_ID --branch-name main --job-type RELEASE
aws amplify get-branch --app-id $APP_ID --branch-name main --query 'branch.[displayName,activeJobId]'
echo "https://main.$APP_ID.amplifyapp.com"
```

3. Espera el build (3-5 min) y abre la URL. **Estado** debe mostrar tus tarjetas verdes.

### Lo que aprendes

Hosting administrado con CDN (CloudFront) incluido, builds por rama (previews de PR), variables de entorno por entorno. Pregunta: ¿cómo lo definirías con CDK? (pista: `aws-cdk-lib/aws-amplify` alpha o `CfnApp`).

### Reto dentro del reto

Agrega la app de Amplify como un `FrontendStack` en CDK usando `@aws-cdk/aws-amplify-alpha` y un secreto de GitHub en Secrets Manager.

---

## Opción B · EC2 con Node (30 min, "a mano", para valorar la opción A)

1. Build local con las variables:

```bash
cd apps/web && npm run build
# activa output: 'standalone' en next.config.ts para un servidor autocontenido
tar czf web.tgz .next/standalone .next/static public
aws s3 cp web.tgz s3://<tu-bucket-documentos>/releases/web.tgz
```

2. Lanza una `t3.micro` en una subred pública de tu VPC de CDK (consulta `vpc-id` en SSM) con un SG que permita el 80, rol con lectura del bucket, y este user data:

```bash
#!/bin/bash
dnf install -y nodejs22 && mkdir -p /opt/web && cd /opt/web
aws s3 cp s3://<bucket>/releases/web.tgz . && tar xzf web.tgz
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
cat > /etc/systemd/system/crediflow-web.service <<EOF
[Service]
Environment=PORT=80
WorkingDirectory=/opt/web/.next/standalone
ExecStart=/usr/bin/node server.js
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl enable --now crediflow-web
```

3. `curl http://<ip-publica>` y abre en el navegador.

### Lo que aprendes

Todo lo que Amplify hace por ti: build, servidor, actualización, HTTPS (aquí no lo hay), CDN, escalado.

---

## Opción C (bonus) · Sitio estático en S3 + CloudFront

Si el frontend no usara SSR, `next build` con `output: 'export'` genera HTML estático que se sube a S3 y se sirve por CloudFront con OAC. Investiga cuándo conviene y qué pierde el frontend de CrediFlow (pista: ninguna página usa SSR hoy, así que es viable).
