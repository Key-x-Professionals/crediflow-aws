# Hoja rápida · Git y GitHub (lo mínimo para trabajar con un pipeline)

## Configuración inicial (una vez)

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@correo.com"
git config --global init.defaultBranch main
gh auth login            # GitHub CLI: HTTPS, navegador
```

## Flujo del curso (rama → PR → revisión → merge → deploy)

```bash
git checkout main && git pull                  # partir de lo último
git checkout -b feat/sesion-4-fargate          # rama de trabajo
# ... cambios ...
git status                                     # qué cambió
git diff                                       # ver el cambio
git add -A && git commit -m "feat: ServiceStack con ECS Fargate"
git push -u origin feat/sesion-4-fargate
gh pr create --fill                            # abre el PR con la plantilla
gh pr checks --watch                           # espera el CI
gh pr merge --squash --delete-branch           # tras la aprobación
git checkout main && git pull
```

## Puntos de partida del curso

```bash
git fetch base --tags                          # "base" = repo del instructor
git tag -l 'a0*'                               # a01-inicio ... a06-solucion
git checkout a04-inicio                        # ver el estado inicial de la sesión 4
git checkout -b feat/sesion-4 a04-inicio       # empezar la sesión desde la etiqueta
git diff a04-inicio a04-solucion -- infra/     # qué se agregó en la sesión 4
```

## Salir de apuros

| Situación | Comando |
|---|---|
| Deshacer cambios no guardados en un archivo | `git checkout -- archivo` |
| Deshacer todo lo no guardado | `git restore .` |
| Guardar cambios a un lado | `git stash` / `git stash pop` |
| Corregir el último mensaje de commit | `git commit --amend -m "mensaje"` |
| Ver historial corto | `git log --oneline -10` |
| Conflicto al hacer merge | editar los archivos marcados `<<<<<<<`, `git add`, `git commit` |
| Traer cambios de main a mi rama | `git merge main` (o `git rebase main`) |

## Mensajes de commit (Conventional Commits)

`feat:` nueva funcionalidad · `fix:` corrección · `docs:` documentación · `test:` pruebas · `chore:` mantenimiento · `refactor:` sin cambio funcional.

## Qué nunca se sube

`.env`, llaves, tokens, `cdk.out/`, `node_modules/`. Si subiste un secreto por error: rótalo **primero**, luego límpialo del historial.
