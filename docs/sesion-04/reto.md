# Sesión 4 · Reto opcional

*No afecta el avance del proyecto.*

## R1. HTTPS en el ALB

Pide al instructor un subdominio en la zona del curso (`<alumno>.crediflow-curso.link`) o usa uno tuyo. Con `aws-cdk-lib/aws-certificatemanager` crea un certificado validado por DNS y agrega un listener 443 al ALB con redirección 80 → 443. Pista: `ApplicationLoadBalancedFargateService` acepta `certificate`, `domainName` y `domainZone`.

## R2. Despliegue blue/green con CodeDeploy

Investiga `deploymentController: { type: DeploymentControllerType.CODE_DEPLOY }` y el construct `EcsDeploymentGroup`. ¿Qué gana CrediFlow frente al rolling update con circuit breaker? ¿Qué cuesta en complejidad?

## R3. Escalado programado

Agrega `scaling.scaleOnSchedule(...)` para bajar a 1 tarea de 20:00 a 06:00 (hora de El Salvador) y subir a 2 en horario laboral. Calcula el ahorro mensual.

## R4. Imagen más pequeña y más segura

Reemplaza la base por `node:22-alpine` → `gcr.io/distroless/nodejs22` o usa `--platform` y `docker scout`/`trivy` para escanear vulnerabilidades. Documenta el antes y el después (tamaño y CVEs).

## R5. Lee un Dockerfile ajeno

Pide a Claude (prompt 4.1) que revise el Dockerfile de otro proyecto que uses en tu trabajo (sin datos sensibles) y propón 3 mejoras.
