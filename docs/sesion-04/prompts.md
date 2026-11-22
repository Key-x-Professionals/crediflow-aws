# Sesión 4 · Biblioteca de prompts (Claude)

## 4.1 Leer un Dockerfile

```
Explica este Dockerfile capa por capa. Luego responde: ¿por qué usa dos etapas? ¿qué pasaría si
no hiciera npm prune? ¿por qué USER node? ¿qué hace HEALTHCHECK y quién lo usa en ECS Fargate (y quién no)?
Finalmente, 3 mejoras concretas de tamaño o seguridad.

<pega apps/api/Dockerfile>
```

## 4.2 Interpretar la prueba de carga

```
Ejecuté una prueba de carga contra una API en ECS Fargate (2 tareas de 0.25 vCPU / 512 MiB detrás
de un ALB, con DynamoDB bajo demanda). Resultados: <pega el resumen>. Durante la prueba el servicio escaló
a <n> tareas y la CPU llegó a <x> %.
Explica qué significan p50, p95 y p99, dónde está probablemente el cuello de botella y qué 3 experimentos
haría para confirmarlo. Señala qué métrica de CloudWatch miraría en cada caso.
```

## 4.3 Propuesta de RTO/RPO

```
CrediFlow recibe solicitudes de crédito por una API (ECS Fargate en 2 AZ, DynamoDB bajo demanda
sin point-in-time recovery). Propón valores de RTO y RPO razonables para (a) la recepción de solicitudes y
(b) los datos de solicitudes, y para cada uno qué cambio de arquitectura haría falta para mejorarlo
un orden de magnitud y cuánto costaría aproximadamente al mes. Preséntalo como tabla.
```

## 4.4 Entender un rollback

```
Este es el estado de un servicio ECS después de un despliegue fallido (salida de describe-services).
Explica la secuencia de eventos: qué intentó el despliegue, por qué falló el health check, qué hizo
el circuit breaker y en qué estado quedó el servicio. ¿Qué habría pasado sin circuit breaker?

<pega la salida>
```

## 4.5 Claude Code (opcional)

```
En infra/lib/stacks/service-stack.ts la API corre con 2 tareas mínimo. Agrega escalado programado
con scaleOnSchedule para bajar a 1 tarea entre 20:00 y 06:00 hora de El Salvador (UTC-6) solo cuando
cfg.env sea "dev". Agrega una prueba. Ejecuta npm test y cdk synth; muéstrame el diff. No despliegues.
```
