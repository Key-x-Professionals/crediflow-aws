# Hoja rápida · Docker (lo que usa el curso)

```bash
docker build -t crediflow-api .                       # construir desde el Dockerfile del directorio
docker build --platform linux/arm64 -t crediflow-api . # misma arquitectura que Fargate ARM64
docker images crediflow-api                           # tamaño
docker run --rm -p 3000:3000 -e STORAGE=memory crediflow-api
docker run --rm -p 3000:3000 --env-file .env crediflow-api
docker ps                                             # contenedores corriendo (+ estado del HEALTHCHECK)
docker logs -f <id>                                   # logs
docker exec -it <id> sh                               # entrar (alpine usa sh)
docker stats --no-stream                              # CPU y memoria
docker stop <id>
docker system prune                                   # limpiar imágenes y contenedores huérfanos
```

## Dockerfile de la API (resumen)

```
FROM node:22-alpine AS build   → instala TODO, compila TypeScript, poda devDependencies
FROM node:22-alpine            → copia solo dist/ y node_modules de producción
USER node                      → nunca root
HEALTHCHECK ... /health        → Docker local lo usa; ECS usa el health check del target group
CMD ["node","dist/server.js"]  → proceso 1 del contenedor; recibe SIGTERM al detener la tarea
```

## ECR (lo hace CDK por ti, pero para saber)

```bash
aws ecr get-login-password | docker login --username AWS --password-stdin <cuenta>.dkr.ecr.<región>.amazonaws.com
aws ecr describe-repositories --query 'repositories[].repositoryName'
aws ecr describe-images --repository-name <repo> --query 'imageDetails[].[imageTags,imagePushedAt,imageSizeInBytes]'
```

`ContainerImage.fromAsset()` construye la imagen, la etiqueta con un hash del contenido y la sube al repositorio `cdk-hnb659fds-container-assets-<cuenta>-<región>` creado por el bootstrap.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `Cannot connect to the Docker daemon` | Abrir Docker Desktop |
| `exec format error` en Fargate | Imagen de otra arquitectura: usar `--platform linux/arm64` o `Platform.LINUX_ARM64` en CDK |
| Contenedor arranca y muere | `docker logs <id>`; falta una variable de entorno |
| Build lento en Windows | Tener el repo en el disco local (no en OneDrive) y usar WSL 2 |
