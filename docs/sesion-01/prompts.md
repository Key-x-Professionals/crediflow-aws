# Sesión 1 · Biblioteca de prompts (Claude)

Regla de la sesión 1: la IA se usa para **entender**, no para generar. Nunca pegues credenciales, ARNs de cuentas reales de Fedecrédito ni datos de clientes.

## 1.1 Explicar una política IAM

```
Soy desarrollador y estoy aprendiendo IAM en AWS. Explícame esta política línea por línea,
en español, como si fuera para alguien que nunca ha visto JSON de IAM.
Al final dime: (1) qué puede hacer la identidad, (2) qué NO puede hacer aunque parezca que sí,
(3) un error común al escribir una política así.

<pega aquí politica.json>
```

## 1.2 Hacer la política más restrictiva (reto)

```
Esta política permite listar y leer objetos de un bucket S3. Propón una versión que:
- solo permita leer objetos bajo el prefijo "publico/"
- exija HTTPS
- expire en 2 horas a partir de ahora (hora UTC: <hora>)
Devuelve la política completa en JSON y una tabla con cada condición y su propósito.
No inventes acciones de IAM; si no estás seguro de una, dímelo.

<pega aquí politica.json>
```

## 1.3 Interpretar un error AccessDenied

```
Recibí este error al ejecutar un comando de la AWS CLI. Identifica:
1. Qué identidad hizo la llamada (usuario, rol, sesión)
2. Qué acción intentó y sobre qué recurso
3. La causa más probable del rechazo
4. Qué cambiaría en la política para permitirla SOLO si es necesario, y por qué podría ser mejor no permitirla

Error:
<pega aquí el error>

Política del rol:
<pega aquí politica.json>
```

## 1.4 Responsabilidad compartida aplicada a CrediFlow

```
CrediFlow es una plataforma ficticia de solicitudes de crédito que vamos a construir en AWS con
ECS Fargate, DynamoDB, S3, Lambda, API Gateway, SQS y EventBridge.
Para cada servicio, dime en una tabla qué es responsabilidad de AWS y qué es responsabilidad
nuestra según el modelo de responsabilidad compartida. Marca con ⚠️ las responsabilidades
nuestras que los equipos suelen olvidar.
```

## 1.5 Estimación de costos

```
Estima el costo mensual en us-east-1 de: 1 EC2 t3.micro encendida 8 h al día, 1 RDS PostgreSQL
db.t4g.micro single-AZ con 20 GB gp3, 1 bucket S3 con 1 GB y 10,000 requests.
Muestra el cálculo y aclara qué supuestos hiciste. Indica qué partidas pueden ser gratis
con la capa gratuita y cuáles nunca lo son.
```
