# Políticas IAM del laboratorio 1

| Archivo | Uso |
|---|---|
| `politica-alumno.json` | Ejemplo de política de mínimo privilegio con variables de política (`${aws:PrincipalTag/Student}`; los usuarios del curso llevan la etiqueta `Student`). Se analiza en clase con Claude. |
| `politica-lectura-s3.json` | Política que cada alumno crea en el laboratorio (reemplazar `STUDENT` y `ACCOUNT_ID`). |
| `trust-policy-lab.json` | Trust policy del rol `crediflow-<alumno>-lab1-lector`: solo el usuario IAM del alumno puede asumirlo (reemplazar `STUDENT` y `ACCOUNT_ID`). |
| `politica-grupo-alumnos.json` | **Instructor.** Política inline del grupo `crediflow-alumnos`: complementa `PowerUserAccess` con IAM acotado a `crediflow-*`/`cdk-*`, Budgets y MFA propio, y niega crear llaves de acceso o usuarios. |

Reemplazo rápido de marcadores:

```bash
# Mac
sed "s/STUDENT/$CF_STUDENT/g; s/ACCOUNT_ID/$CDK_DEFAULT_ACCOUNT/g" scripts/iam/politica-lectura-s3.json > /tmp/politica.json
```
```powershell
# Windows
(Get-Content scripts\iam\politica-lectura-s3.json) -replace 'STUDENT', $env:CF_STUDENT -replace 'ACCOUNT_ID', $env:CDK_DEFAULT_ACCOUNT | Set-Content $env:TEMP\politica.json
```
