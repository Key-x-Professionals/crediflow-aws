# CrediFlow Web

Frontend terminado de CrediFlow (Next.js). **No hay que programarlo**: solo se conecta al backend de cada alumno mediante variables de entorno.

## Operaciones que ofrece

| Pantalla | Backend | Operación |
|---|---|---|
| Estado | API contenedores + API serverless | `GET /health`, `GET /info` |
| Solicitudes | API contenedores | `GET /solicitudes`, `GET /solicitudes/:id` |
| Nueva solicitud | API contenedores | `POST /solicitudes` |
| Precalificación | Cognito + API serverless | login, `POST /precalificar`, `GET /precalificaciones` |

## Correr local

```bash
# Mac / Windows (PowerShell)
cd apps/web
cp .env.example .env.local        # Windows: Copy-Item .env.example .env.local
npm install
npm run dev                       # http://localhost:3001
```

## Conectar con TU backend en AWS

Desde la raíz del repo, con tu `.env` y perfil de AWS configurados:

```bash
# Mac
./scripts/mac/web-env.sh
# Windows
.\scripts\windows\web-env.ps1
```

El script lee los parámetros de SSM (`/crediflow/<alumno>/<env>/api-url`, `precal-url`, `user-pool-id`, `user-pool-client-id`) y genera `apps/web/.env.local`.

## Reto extra: desplegarlo

Ver `docs/retos/frontend-amplify-ec2.md`.
