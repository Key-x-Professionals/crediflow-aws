# CrediFlow · Proyecto integrador del curso AWS

> Key Institute · Programa de formación AWS para Fedecrédito · 6 sesiones de 3 horas

CrediFlow es una **plataforma ficticia de solicitudes de crédito** que se construye sesión a sesión en AWS:

```
                 ┌──────────────┐      POST /solicitudes      ┌─────────────────────┐
  Frontend  ───► │  ALB + WAF   │ ───────────────────────────► │  API (ECS Fargate)  │──► DynamoDB (solicitudes)
  Next.js        └──────────────┘                              └──────────┬──────────┘
     │                                                                    │ SQS
     │  POST /precalificar (JWT Cognito)                                  ▼
     │           ┌──────────────┐     ┌────────────┐          ┌─────────────────────┐
     └─────────► │ API Gateway  │ ──► │  Lambda    │ ──► DDB  │  Worker (Lambda)    │──► EventBridge ──► SNS / Lambda
                 └──────────────┘     └────────────┘          │  idempotente + DLQ  │
                                                               └─────────────────────┘
```

| Sesión | Qué se agrega | Stack / carpeta |
|---|---|---|
| 1 | Cuenta, acceso con `aws login`, CLI, SDK, mínimo privilegio, costos | `scripts/iam`, `scripts/sdk` |
| 2 | Despliegue manual: VPC + EC2 + RDS + S3 (se destruye al cierre de la sesión) | `scripts/manual` |
| 3 | Red (sin NAT), DynamoDB + S3 y pipeline OIDC como código | `NetworkStack`, `DataStack`, `CicdStack` |
| 4 | API en ECS Fargate con ALB, autoscaling y rollback | `ServiceStack` |
| 5 | Precalificación serverless + evaluación asíncrona | `ServerlessStack`, `EventsStack` |
| 6 | WAF, GuardDuty, cdk-nag, dashboard, alarmas, simulacro | `SecurityStack`, `ObservabilityStack` |

## Estructura del repositorio

```
crediflow/
├── infra/                  # AWS CDK (TypeScript)
│   ├── bin/crediflow.ts    #   punto de entrada: instancia los stacks
│   └── lib/
│       ├── config.ts       #   configuración por alumno (.env)
│       ├── naming.ts       #   NameBuilder y ArnBuilder
│       ├── crediflow-stack.ts  # clase base con etiquetas y helpers
│       ├── constructs/     #   bloques reutilizables (VPC, bucket, tabla, Fargate, Lambda, API, cola...)
│       └── stacks/         #   un stack por sesión
├── apps/
│   ├── api/                # API de solicitudes (Express; memoria / PostgreSQL / DynamoDB) → contenedor
│   ├── precalificacion/    # Lambdas de la API serverless
│   ├── worker/             # Lambdas: evaluador (SQS) y notificador (EventBridge)
│   └── web/                # Frontend Next.js TERMINADO (solo se configura)
├── scripts/
│   ├── verify-setup.js     # verificación del entorno (todas las plataformas)
│   ├── mac/  windows/      # helpers por sistema operativo
│   ├── iam/                # políticas del laboratorio 1
│   ├── manual/             # despliegue artesanal de la sesión 2 (bash y PowerShell)
│   ├── sdk/                # ejemplo con el SDK (sesión 1)
│   ├── load/               # prueba de carga (sesiones 4 y 6)
│   └── simulacro/          # fallas del simulacro de incidente (sesión 6, instructor)
├── docs/                   # guías de laboratorio, checklists, retos, prompts, cheatsheets
└── .github/workflows/      # CI (PR) y deploy (OIDC) — sesión 3
```

## Empezar (sesión 1)

Este repositorio es la **base del curso**: es de solo lectura. Lo clonas para trabajar en tu máquina y, en la sesión 3, creas **tu propio repositorio privado** a partir de tu copia (la guía de esa sesión te lleva paso a paso).

```bash
git clone https://github.com/Key-x-Professionals/crediflow-aws.git crediflow && cd crediflow
cp .env.example .env              # Windows: Copy-Item .env.example .env
# edita .env: CF_STUDENT, CDK_DEFAULT_ACCOUNT, CDK_DEFAULT_REGION, CF_ALERT_EMAIL
npm install                       # también instala un aviso al hacer commit en main
npm run verify                    # verifica herramientas y sesión de AWS
```

Cómo quedan los remotos:

| Momento | `origin` | `base` |
|---|---|---|
| Sesiones 1 y 2 | Este repositorio (solo lectura) | — |
| Desde la sesión 3 | **Tu repositorio privado** (ahí haces push y corre tu pipeline) | Este repositorio (solo lectura; de aquí traes las etiquetas) |

Puntos de partida por sesión. Cada guía trae los archivos de su etiqueta al llegar:

```bash
git fetch base --tags                                     # origin en las sesiones 1 y 2
git checkout a04-inicio -- infra/lib/stacks infra/bin     # el punto de partida de la sesión 4
git checkout a04-solucion -- infra/lib/stacks infra/bin   # si te atrasaste: la solución de la sesión 4
```

## Costo casi cero (léelo antes de desplegar)

La cuenta del curso es una cuenta nueva con el plan gratuito de AWS: todo consume crédito, así que CrediFlow no tiene costos fijos (DynamoDB en lugar de RDS, sin NAT Gateway, Lambdas fuera de la VPC) y **los stacks se encienden al inicio de cada sesión y se apagan al final**:

```bash
npm run encender     # cdk deploy --all
npm run apagar       # cdk destroy --all
npm run costos       # qué sigue encendido y cuánto llevas gastado
```

Detalle y tabla de costos por sesión en [`docs/00-preparacion/costos.md`](docs/00-preparacion/costos.md).

## Convenciones

- **Todos los recursos** se nombran `crediflow-<alumno>-<env>-<recurso>` mediante `this.names.*`. Nunca escribas nombres a mano.
- **Todo se despliega con CDK** a partir de la sesión 3. Nada se crea desde la consola.
- **Nunca** datos, credenciales ni sistemas reales de Fedecrédito. Solo el caso ficticio.
- Cada alumno trabaja en **su propia copia local** (y su propio repositorio GitHub desde la sesión 3).

## Comandos más usados

```bash
npm run verify                        # entorno
npm run api:dev                       # API local en http://localhost:3000 (sin base de datos)
npm run synth                         # cdk synth de todos los stacks
npm run diff                          # qué cambiaría en AWS
npm run deploy -- CrediFlow-<alumno>-dev-Network   # desplegar un stack
npm run encender                      # desplegar todo (inicio de la sesión)
npm run apagar                        # destruir todo (final de la sesión)
npm run costos                        # recursos encendidos y gasto del mes
npm run nag -w infra                  # revisión de buenas prácticas con cdk-nag
```

Documentación completa en [`docs/README.md`](docs/README.md).
