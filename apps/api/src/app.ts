/**
 * API de solicitudes de CrediFlow.
 *
 * Operaciones (finitas, a propósito):
 *   GET  /health            estado del servicio, la base de datos y la cola
 *   GET  /info              identidad del despliegue (alumno, entorno, versión)
 *   POST /solicitudes       registra una solicitud de crédito
 *   GET  /solicitudes       lista las últimas solicitudes
 *   GET  /solicitudes/:id   consulta una solicitud y su estado
 *   POST /solicitudes/:id/estado   (uso interno del worker / pruebas) cambia el estado
 */
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ESTADOS, NuevaSolicitudSchema } from './domain';
import { Storage } from './storage';

export interface AppOptions {
  storage: Storage;
  queueUrl?: string;
  sqs?: SQSClient;
  version?: string;
}

export function createApp(opts: AppOptions): express.Express {
  const app = express();
  const startedAt = new Date().toISOString();
  const sqs = opts.sqs ?? (opts.queueUrl ? new SQSClient({}) : undefined);

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // Log estructurado por solicitud (se ve en CloudWatch Logs)
  app.use((req, res, next) => {
    const requestId = (req.header('x-request-id') as string) ?? randomUUID();
    const start = Date.now();
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      );
    });
    next();
  });

  app.get('/health', async (_req, res) => {
    // Simulador de despliegue roto (sesión 4): con FAIL_HEALTH=true el ALB marca la tarea como no sana
    if (process.env.FAIL_HEALTH === 'true') {
      return res.status(500).json({ status: 'broken', reason: 'FAIL_HEALTH=true (simulación de despliegue roto)' });
    }
    const dbOk = await opts.storage.ping();
    const status = dbOk ? 'ok' : 'degraded';
    return res.status(dbOk ? 200 : 503).json({
      status,
      storage: opts.storage.kind,
      database: dbOk ? 'ok' : 'unavailable',
      queue: opts.queueUrl ? 'configured' : 'not-configured',
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.get('/info', (_req, res) => {
    res.json({
      service: 'crediflow-api',
      version: opts.version ?? process.env.APP_VERSION ?? '0.1.0',
      student: process.env.CF_STUDENT ?? 'local',
      env: process.env.CF_ENV ?? 'local',
      region: process.env.AWS_REGION ?? 'local',
      hostname: process.env.HOSTNAME ?? 'local',
      estados: ESTADOS,
    });
  });

  app.post('/solicitudes', async (req, res, next) => {
    try {
      const parsed = NuevaSolicitudSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Solicitud inválida', detalles: parsed.error.flatten().fieldErrors });
      }
      const estado = opts.queueUrl ? 'EN_EVALUACION' : 'RECIBIDA';
      const solicitud = await opts.storage.crear(parsed.data, estado);

      if (opts.queueUrl && sqs) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: opts.queueUrl,
            MessageBody: JSON.stringify({ tipo: 'EvaluarSolicitud', solicitudId: solicitud.id, solicitud }),
            MessageAttributes: { tipo: { DataType: 'String', StringValue: 'EvaluarSolicitud' } },
          }),
        );
      }
      return res.status(201).json(solicitud);
    } catch (err) {
      return next(err);
    }
  });

  app.get('/solicitudes', async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      res.json(await opts.storage.listar(limit));
    } catch (err) {
      next(err);
    }
  });

  app.get('/solicitudes/:id', async (req, res, next) => {
    try {
      const s = await opts.storage.obtener(req.params.id);
      if (!s) return res.status(404).json({ error: 'Solicitud no encontrada' });
      return res.json(s);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/solicitudes/:id/estado', async (req, res, next) => {
    try {
      const { estado, resultado } = req.body ?? {};
      if (!ESTADOS.includes(estado)) return res.status(400).json({ error: `estado debe ser uno de ${ESTADOS.join(', ')}` });
      const s = await opts.storage.actualizarEstado(req.params.id, estado, resultado);
      if (!s) return res.status(404).json({ error: 'Solicitud no encontrada' });
      return res.json(s);
    } catch (err) {
      return next(err);
    }
  });

  // Endpoint de "caos" para el simulacro de la sesión 6: fuerza un error 500
  app.get('/chaos/error', (_req, res) => {
    res.status(500).json({ error: 'Falla simulada para el simulacro de incidente' });
  });

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }));
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
