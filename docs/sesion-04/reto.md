# Sesión 4 · Reto para casa (opcional, 30-45 min, sin costo)

**Objetivo.** Hacer la imagen de la API más pequeña y con menos vulnerabilidades, sin cambiar su comportamiento. Todo ocurre en tu máquina con Docker: no hay que desplegar nada.

**Cómo.** Mide el punto de partida:

```bash
cd apps/api
docker build -t crediflow-api:antes .
docker images crediflow-api
docker scout quickview crediflow-api:antes        # viene con Docker Desktop; alternativa: trivy image crediflow-api:antes
```

Prueba mejoras en una copia del Dockerfile (por ejemplo `Dockerfile.reto`) y construye con `docker build -f Dockerfile.reto -t crediflow-api:despues .`. Ideas, de menor a mayor esfuerzo:

1. Un archivo `.dockerignore` que excluya `node_modules`, `dist` y las pruebas del contexto de construcción.
2. `npm ci` en lugar de `npm install` (requiere copiar también `package-lock.json`; en este repositorio el *lock* está en la raíz del monorepo: ¿cómo lo resolverías?).
3. Una imagen final *distroless*: `FROM gcr.io/distroless/nodejs22-debian12` en la segunda etapa, con `CMD ["dist/server.js"]`.

**Cómo comprobar.** La imagen nueva debe seguir respondiendo:

```bash
docker run --rm -p 3000:3000 -e STORAGE=memory crediflow-api:despues
curl -s localhost:3000/health
```

Compara tamaño y vulnerabilidades críticas y altas, antes y después. Con *distroless* notarás que el `HEALTHCHECK` del Dockerfile deja de funcionar: no hay `wget` ni shell dentro de la imagen. ¿Importa en AWS? (Pista: ¿quién comprueba la salud de las tareas en Fargate?)

**Qué entregas.** En el canal del curso: una tabla con el antes y el después (megabytes y vulnerabilidades), tu Dockerfile y una frase sobre qué mejora dio más resultado. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir.

**Bonus.** Agrega al workflow de CI un paso que escanee la imagen y falle si hay vulnerabilidades críticas. ¿En qué momento del pipeline lo pondrías?
