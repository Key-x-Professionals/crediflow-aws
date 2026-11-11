# Hoja rápida · AWS CLI

```
aws <servicio> <operación> [--parámetros] [--query <JMESPath>] [--output json|table|text]
```

## Sesión y perfil

| Comando | Qué hace |
|---|---|
| `aws login --profile crediflow` | Inicia sesión con tu usuario (navegador; credenciales temporales hasta 12 h) |
| `aws logout --profile crediflow` | Cierra la sesión de la CLI |
| `aws sts get-caller-identity` | ¿Quién soy? |
| `export AWS_PROFILE=crediflow` / `$env:AWS_PROFILE='crediflow'` | Perfil por defecto (Mac / Windows) |
| `aws configure list` | Qué perfil, región y credenciales está usando |

## Formato de salida y filtros

```bash
aws ec2 describe-instances --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress]' --output table
aws s3api list-buckets --query 'Buckets[?starts_with(Name, `crediflow`)].Name' --output text
aws dynamodb list-tables --query 'TableNames[?starts_with(@, `crediflow`)]' --output text
export AWS_PAGER=""         # sin paginador interactivo (Windows: $env:AWS_PAGER='')
```

## Los más usados en el curso

```bash
# CloudFormation
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[].StackName'
aws cloudformation describe-stack-events --stack-name <stack> --max-items 10
aws cloudformation describe-stacks --stack-name <stack> --query 'Stacks[0].Outputs'

# SSM Parameter Store (dónde quedan las URLs de CrediFlow)
aws ssm get-parameters-by-path --path /crediflow/$CF_STUDENT/dev --query 'Parameters[].[Name,Value]' --output table

# Logs
aws logs tail <log-group> --since 10m --follow --format short
aws logs describe-log-groups --log-group-name-prefix /crediflow

# ECS
aws ecs describe-services --cluster <c> --services <s> --query 'services[0].[runningCount,desiredCount,deployments[0].rolloutState]'
aws ecs list-tasks --cluster <c>; aws ecs stop-task --cluster <c> --task <arn>
aws ecs execute-command --cluster <c> --task <arn> --container api --interactive --command "/bin/sh"   # requiere enableExecuteCommand

# Lambda
aws lambda invoke --function-name <fn> --payload '{}' --cli-binary-format raw-in-base64-out out.json && cat out.json
aws lambda update-function-configuration --function-name <fn> --environment "Variables={FAILURE_RATE=0}"

# SQS
aws sqs get-queue-attributes --queue-url <url> --attribute-names ApproximateNumberOfMessages
aws sqs send-message --queue-url <url> --message-body '{"tipo":"EvaluarSolicitud",...}'
aws sqs receive-message --queue-url <url> --max-number-of-messages 1; aws sqs purge-queue --queue-url <url>

# Cognito
aws cognito-idp admin-create-user --user-pool-id <id> --username <email> --message-action SUPPRESS
aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id <id> --auth-parameters USERNAME=...,PASSWORD=...

# CloudWatch
aws cloudwatch describe-alarms --state-value ALARM
aws cloudwatch set-alarm-state --alarm-name <n> --state-value ALARM --state-reason "prueba"   # probar notificaciones

# Session Manager
aws ssm start-session --target <instance-id>

# Inventario por etiqueta
aws resourcegroupstaggingapi get-resources --tag-filters Key=Student,Values=$CF_STUDENT --query 'ResourceTagMappingList[].ResourceARN'
```

## Diferencias Mac ↔ Windows

| Mac (bash/zsh) | Windows (PowerShell) |
|---|---|
| `export X=valor` | `$env:X = 'valor'` |
| `$X` | `$env:X` |
| `\` al final de línea para continuar | `` ` `` (acento grave) al final de línea |
| `'{"a":1}'` (comillas simples) | `'{\"a\":1}'` o usar `file://archivo.json` |
| `$(comando)` | `$(comando)` (igual) |
| `curl -s URL` | `Invoke-RestMethod URL` |
| `cat archivo` | `Get-Content archivo` |
| `grep patrón` | `Select-String patrón` |

Consejo: para JSON complicado en Windows, escríbelo en un archivo y usa `--cli-input-json file://x.json` o `--policy-document file://x.json`.
