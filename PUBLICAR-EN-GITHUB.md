# El repositorio base en GitHub (instructor)

El repositorio base del curso está publicado en <https://github.com/Key-x-Professionals/crediflow-aws>. La rama `main` contiene la solución completa y está protegida; las etiquetas `a0N-inicio` y `a0N-solucion` marcan el punto de partida y la solución de cada sesión.

Las etiquetas viven en una línea de commits propia (una por etapa del curso), distinta de la de `main`. Es normal: los alumnos no cambian de rama a una etiqueta, solo traen sus archivos con `git checkout a0N-inicio -- infra/lib/stacks infra/bin`.

```bash
git clone https://github.com/Key-x-Professionals/crediflow-aws.git crediflow && cd crediflow
git tag -l                   # a01-inicio ... a06-solucion
```

**Flujo de los alumnos.** Clonan este repositorio (solo lectura). En la sesión 3 lo renombran a `base` y crean su repositorio **privado** con `gh repo create crediflow --private --source=. --remote=origin --push`: ahí hacen push y corre su pipeline. No se usan forks.

## Qué contiene cada etiqueta

| Etiqueta | Estado |
|---|---|
| `a01-inicio` / `a01-solucion` | Base: constructs CDK, API, Lambdas, frontend, docs y scripts (sin stacks) |
| `a02-inicio` / `a02-solucion` | + scripts de despliegue manual |
| `a03-inicio` | + esqueletos (TODO) de Network, Data, Cicd + workflows (el despliegue a prod es manual y no se usa en el curso) |
| `a03-solucion` = `a04-inicio` | Network, Data, Cicd completos; esqueleto de Service |
| `a04-solucion` = `a05-inicio` | Service completo (sin cola); Serverless y Events casi completos: el alumno los lee y escribe permisos, rutas y reglas |
| `a05-solucion` = `a06-inicio` | Serverless y Events completos; Service con cola; Security y Observability casi completos; cdk-nag con 2 errores por resolver |
| `a06-solucion` = `main` | Todo completo, cdk-nag sin errores |

> Todas las etiquetas están publicadas. Si en una edición futura prefieres que las soluciones no se vean por adelantado, borra las etiquetas `a0N-solucion` del remoto (`git push origin :refs/tags/a06-solucion`) y vuelve a empujarlas al terminar cada sesión. Ten en cuenta que `a0N-solucion` y `a0(N+1)-inicio` son el mismo commit.

## Antes de la sesión 1

1. La URL del repositorio ya está en `README.md` y en `docs/00-preparacion/instalacion.md`.
2. Crea el grupo `crediflow-alumnos` y un usuario IAM por alumno (anexo de la guía del docente de la sesión 1; política en `scripts/iam/politica-grupo-alumnos.json`).
3. Haz los ajustes de cuenta de una sola vez (proveedor OIDC de GitHub, bootstrap de CDK, rol de registros de API Gateway, cuotas): están en `docs/00-preparacion/acceso-aws.md`, sección "Para el instructor".
4. Ensaya cada sesión con un usuario de prueba, incluidas las tres fallas del simulacro de la sesión 6 (`scripts/simulacro/falla.js`).
5. Borra este archivo del repositorio si no quieres que los alumnos lo vean (`git rm PUBLICAR-EN-GITHUB.md`).
