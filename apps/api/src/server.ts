import { createApp } from './app';
import { createStorage } from './storage';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const storage = createStorage();

  try {
    await storage.init();
    console.log(JSON.stringify({ level: 'info', message: `Almacenamiento listo (${storage.kind})` }));
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: 'No se pudo inicializar la base de datos', error: String(err) }));
    // Seguimos arrancando: /health reportará "degraded" y el ALB lo detectará.
  }

  const app = createApp({ storage, queueUrl: process.env.QUEUE_URL || undefined });
  const server = app.listen(port, () => {
    console.log(JSON.stringify({ level: 'info', message: `CrediFlow API escuchando en el puerto ${port}` }));
  });

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ level: 'info', message: `Recibido ${signal}, cerrando...` }));
    server.close(async () => {
      await storage.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
