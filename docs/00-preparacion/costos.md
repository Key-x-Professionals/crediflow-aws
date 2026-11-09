# Costos: cómo mantener el curso en (casi) cero

La cuenta del curso es **una sola cuenta nueva de AWS con el plan gratuito**: recibe USD 100 de crédito al abrirse (hasta USD 200 completando actividades) y el plan dura **6 meses o hasta agotar el crédito, lo que ocurra primero**. Ya no existe el "año gratis" de EC2 o RDS: **todo lo que se cree consume crédito**, salvo lo que es *siempre gratis*. Si el crédito se acaba, la cuenta se suspende (y con ella el curso). Por eso CrediFlow está diseñado para no tener costos fijos y por eso hay una regla de oro.

## La regla de oro: encender al inicio, apagar al final

Los recursos que cobran **por hora aunque nadie los use** son: el balanceador (ALB), las tareas de Fargate, NAT Gateways, instancias EC2 y RDS. Todo lo demás de CrediFlow (DynamoDB, Lambda, SQS, SNS, EventBridge, API Gateway, Cognito, S3, IAM, CloudWatch básico) cobra por uso y a la escala del curso cuesta centavos o está dentro de lo siempre gratis.

Cada sesión, desde la 3, empieza y termina así:

```bash
npm run encender      # cdk deploy --all  (10-12 min la primera vez; 3-5 min después)
# ... laboratorio ...
npm run apagar        # cdk destroy --all (5 min). Los datos de DynamoDB y S3 en dev también se borran: son ficticios.
npm run costos        # ¿qué sigue encendido? ¿cuánto llevo gastado?
```

Si olvidas apagar, el presupuesto de la cuenta (lo administra el instructor, con alerta al 80 %) avisa por correo, y el instructor revisa Cost Explorer por etiqueta `Student` antes de cada sesión.

## Decisiones de diseño por costo

| Decisión | Alternativa descartada | Ahorro por alumno |
|---|---|---|
| **DynamoDB** bajo demanda para las solicitudes | RDS PostgreSQL db.t4g.micro (~13 USD/mes + almacenamiento + Secrets Manager) | ~15 USD/mes y cero costo fijo |
| **Sin NAT Gateway**: tareas Fargate con IP pública en subred pública, protegidas por security group | 1 NAT por VPC (~32 USD/mes + GB) | ~32 USD/mes |
| **Sin endpoints de interfaz** (SSM, ECR) | 3 endpoints (~7 USD/mes cada uno) | ~21 USD/mes |
| Worker y Lambdas **fuera de la VPC** (hablan con DynamoDB por internet/TLS) | Lambda en VPC (necesitaría NAT) | incluido arriba |
| ALB y Fargate **solo durante la sesión** | Encendidos todo el mes (~30 USD/mes) | ~29 USD/mes |
| Container Insights y PITR de DynamoDB **apagados en dev** | Activos (por métrica / por GB) | 1-3 USD/mes |
| RDS **solo en la sesión 2**, creado y destruido en la misma clase | RDS vivo hasta la sesión 3 | ~3 USD |

## Costo estimado por alumno (us-east-1, precios de referencia de noviembre 2026)

| Sesión | Qué queda encendido durante la clase (3 h) | Costo de la clase | Qué queda después |
|---|---|---|---|
| 1 | Bucket con un objeto, rol IAM | 0.00 | 0.00 USD/mes |
| 2 | EC2 t3.micro + IP pública + RDS t4g.micro 20 GB + S3 | ~0.15 | 0.00 (se destruye al cierre) |
| 3 | VPC sin NAT, DynamoDB, 2 buckets, rol OIDC | ~0.00 | ~0.01 USD/mes (S3) |
| 4 | + ALB + 2 tareas Fargate 0.25 vCPU ARM + 2 IP públicas | ~0.20 | 0.00 (apagado) |
| 5 | + Lambda, SQS, EventBridge, SNS, API Gateway, Cognito | ~0.20 | ~0.00 |
| 6 | + WAF (5 USD/mes prorrateado por hora ≈ 0.02) + dashboard + 6 alarmas | ~0.25 | dashboard 3 USD/mes y alarmas 0.60 USD/mes **si no se apagan** |
| Pipeline (GitHub Actions) | Runners de GitHub, gratis en repos públicos / 2,000 min en privados | 0.00 | 0.00 |

**Total por alumno para todo el curso: menos de 1 USD** si se apaga al final de cada sesión. Con 15 alumnos, el curso completo cabe holgadamente en los USD 100 de crédito; el margen es para olvidos. El instructor mantiene además su entorno de referencia (~0.50 USD por sesión) y GuardDuty a nivel de cuenta (30 días de prueba gratis; después unos pocos dólares al mes por el volumen de CloudTrail de toda la cuenta).

Lo que **no** cuesta: IAM Identity Center, IAM, Budgets (los dos primeros gratis), Cost Explorer (la consola), CloudFormation, CDK, Cognito hasta 10,000 usuarios activos, Lambda hasta 1 millón de invocaciones y 400,000 GB-s al mes, DynamoDB hasta 25 GB, SQS hasta 1 millón de peticiones, SNS hasta 1 millón de publicaciones, EventBridge (eventos de servicios AWS gratis; personalizados 1 USD por millón).

## Cómo lo verificas tú

- `npm run costos` lista tus recursos con etiqueta `Student` y marca los que cobran por hora.
- Consola → **Billing and Cost Management → Free Tier**: crédito restante y días del plan gratuito.
- **Cost Explorer** filtrado por la etiqueta `Student` (los datos tardan hasta 24 h).
- Consola → **Billing and Cost Management → Free Tier**: crédito restante y días del plan gratuito (lo miras desde la sesión 1).

## Y si quieres un ambiente "tipo producción"

Las decisiones de arriba son explícitas en el código y se revierten con configuración, no reescribiendo: `CF_NAT=true` agrega subredes privadas con NAT y mueve las tareas a ellas; `CF_ENV=prod` activa Multi-AZ en lo que aplique, PITR en DynamoDB, retención de recursos y mínimo 2 tareas con más máximo. Así el curso enseña la arquitectura correcta y la factura del curso sigue en cero.

Fuentes: [AWS Free Tier (plan gratuito y créditos)](https://aws.amazon.com/free/), [Preguntas frecuentes del Free Tier](https://aws.amazon.com/free/free-tier-faqs/), [Documentación de facturación: Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html).
