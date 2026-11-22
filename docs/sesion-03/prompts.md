# Sesión 3 · Biblioteca de prompts (Claude)

Desde esta sesión la IA también **genera** código, con la regla: todo lo generado se lee, se entiende y se prueba antes de integrarlo. Claude Code (si tu plan lo incluye) puede trabajar directamente sobre el repositorio.

## 3.1 Del documento manual al código

```
Este es el documento de un despliegue manual en AWS (VPC, subredes, SG, EC2, RDS, S3).
Tengo un proyecto AWS CDK en TypeScript con estos constructs disponibles: CrediFlowVpc, SecureBucket,
CrediFlowTable (ver código abajo). Explícame qué partes del documento cubre cada construct,
qué decisiones del despliegue manual NO están en el código y si deberían estarlo. Ten en cuenta que
la base de datos cambió de RDS PostgreSQL (manual) a DynamoDB (CDK): explícame qué gano y qué pierdo.

Documento: <pega despliegue-manual-<equipo>.md>
Constructs: <pega crediflow-vpc.ts y crediflow-table.ts>
```

## 3.2 Pruebas adicionales

```
Este es un stack de AWS CDK (TypeScript) y su archivo de pruebas con aws-cdk-lib/assertions.
Propón 3 pruebas adicionales que verifiquen decisiones de SEGURIDAD o COSTO (no triviales),
con el código completo de cada una. Explica en una frase qué regresión evitaría cada prueba.

Stack: <pega data-stack.ts>
Pruebas: <pega data-stack.test.ts>
```

## 3.3 Interpretar un `cdk diff`

```
Esta es la salida de `cdk diff`. Para cada recurso dime si se crea, actualiza en sitio,
REEMPLAZA (destruye y crea) o destruye, y qué impacto tendría en un sistema en producción
(pérdida de datos, caída, cambio de IP, etc.). Al final: ¿aplicarías este cambio en horario laboral?

<pega la salida>
```

## 3.4 Explicar un job fallido de GitHub Actions

```
Este es el log de un job de GitHub Actions que falló al desplegar con AWS CDK usando OIDC.
Identifica la línea exacta del error, la causa raíz probable (permisos del rol, trust policy,
variable faltante, error de compilación, etc.) y los pasos para corregirla. Si es un problema
de la trust policy, muéstrame cómo debería verse la condición `sub`.

<pega el log>
```

## 3.5 CDK vs Terraform (reto)

```
Muestra el equivalente en Terraform (HCL) de este stack de CDK. Luego compara en una tabla:
manejo de estado, lenguaje, abstracciones de alto nivel (L2/L3 vs módulos), pruebas, y cómo
se vería el pipeline con OIDC en cada caso.

<pega network-stack.ts y crediflow-vpc.ts>
```

## 3.6 Claude Code (opcional): tarea acotada

```
En infra/lib/stacks/data-stack.ts agrega un parámetro SSM con el endpoint de la base de datos
(usa this.publishParameter como en los demás). Agrega una prueba en test/data-stack.test.ts
que verifique que existe un AWS::SSM::Parameter cuyo nombre termina en "db-endpoint".
Ejecuta npm test y muéstrame el diff. No despliegues nada.
```
