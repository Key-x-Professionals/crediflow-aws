# Publicar el repositorio base en GitHub (instructor)

El ZIP incluye el historial git con las etiquetas de cada sesión. Solo hay que crear el repositorio remoto y empujar.

```bash
unzip crediflow-repo-base.zip && cd crediflow
git log --oneline            # 8 commits
git tag -l                   # a01-inicio ... a06-solucion

# Opción A: GitHub CLI (crea el repo en tu organización/usuario)
gh auth login
gh repo create keyinstitute/crediflow-aws --public --source=. --remote=origin --push
git push origin --tags

# Opción B: repo creado desde github.com
git remote add origin git@github.com:<org>/crediflow-aws.git
git push -u origin main && git push origin --tags
```

## Qué contiene cada etiqueta

| Etiqueta | Estado |
|---|---|
| `a01-inicio` / `a01-solucion` | Base: constructs CDK, API, Lambdas, frontend, docs y scripts (sin stacks) |
| `a02-inicio` / `a02-solucion` | + scripts de despliegue manual |
| `a03-inicio` | + esqueletos (TODO) de Network, Data, Cicd + workflows |
| `a03-solucion` = `a04-inicio` | Network, Data, Cicd completos; esqueleto de Service |
| `a04-solucion` = `a05-inicio` | Service completo (sin cola); esqueletos de Serverless y Events |
| `a05-solucion` = `a06-inicio` | Serverless y Events completos; Service con cola; esqueletos de Security y Observability |
| `a06-solucion` = `main` | Todo completo, cdk-nag sin errores |

> Recomendación: si quieres que los alumnos no vean las soluciones por adelantado, publica solo hasta `a0N-inicio` y empuja `a0N-solucion` al terminar cada sesión (`git push origin a03-solucion`). Para eso, en lugar de `--tags`, empuja las etiquetas una a una.

## Antes de la sesión 1

1. Reemplaza `<url-del-repo-base>` en `README.md` y `docs/00-preparacion/instalacion.md` por la URL real.
2. Crea el grupo `crediflow-alumnos` y un usuario IAM por alumno (anexo de la guía del docente de la sesión 1; política en `scripts/iam/politica-grupo-alumnos.json`).
3. Borra este archivo del repo si no quieres que los alumnos lo vean (`git rm PUBLICAR-EN-GITHUB.md`).
