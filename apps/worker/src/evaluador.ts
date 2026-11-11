/**
 * Worker de evaluación (consumidor de SQS).
 *
 *  1. Recibe lotes de mensajes "EvaluarSolicitud"
 *  2. Idempotencia: registra el solicitudId en DynamoDB con una escritura condicional.
 *     Si ya existe, el mensaje es un duplicado y se ignora sin error.
 *  3. Evalúa y actualiza la tabla DynamoDB de solicitudes (estado + resultado)
 *  4. Publica el evento "SolicitudEvaluada" en EventBridge
 *  5. Reporta fallas parciales por mensaje (reportBatchItemFailures) para que
 *     SQS reintente SOLO los mensajes que fallaron
 */
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { evaluar } from './scoring';

const logger = new Logger();
const metrics = new Metrics();
const tracer = new Tracer();

const ddb = DynamoDBDocumentClient.from(tracer.captureAWSv3Client(new DynamoDBClient({})));
const eventBridge = tracer.captureAWSv3Client(new EventBridgeClient({}));

const TABLE_NAME = process.env.TABLE_NAME!;
const IDEMPOTENCY_TABLE = process.env.IDEMPOTENCY_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const FAILURE_RATE = Number(process.env.FAILURE_RATE ?? '0');

interface Mensaje {
  tipo: string;
  solicitudId: string;
  solicitud: { monto: number; plazoMeses: number; ingresoMensual: number; proposito: string; nombre: string };
}

/** Devuelve false si el mensaje ya fue procesado (duplicado) */
async function reclamar(solicitudId: string): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: IDEMPOTENCY_TABLE,
        Item: { pk: `SOLICITUD#${solicitudId}`, expiresAt: Math.floor(Date.now() / 1000) + 24 * 3600 },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    return true;
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

async function liberar(solicitudId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: IDEMPOTENCY_TABLE, Key: { pk: `SOLICITUD#${solicitudId}` } }));
}

async function procesar(record: SQSRecord): Promise<void> {
  const msg = JSON.parse(record.body) as Mensaje;
  logger.appendKeys({ solicitudId: msg.solicitudId, messageId: record.messageId });

  if (msg.tipo !== 'EvaluarSolicitud') {
    logger.warn('Tipo de mensaje desconocido, se descarta', { tipo: msg.tipo });
    return;
  }

  if (!(await reclamar(msg.solicitudId))) {
    logger.info('Mensaje duplicado ignorado (idempotencia)');
    metrics.addMetric('MensajesDuplicados', MetricUnit.Count, 1);
    return;
  }

  try {
    // Simulador de fallas para el simulacro de incidente (sesión 6)
    if (FAILURE_RATE > 0 && Math.random() < FAILURE_RATE) {
      throw new Error('Falla simulada del evaluador (FAILURE_RATE)');
    }

    const evaluacion = evaluar(msg.solicitud);
    // La condición attribute_exists hace que un id inexistente falle (y termine en la DLQ tras 3 intentos)
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: msg.solicitudId },
        ConditionExpression: 'attribute_exists(id)',
        UpdateExpression: 'SET estado = :e, resultado = :r, actualizadaEn = :t',
        ExpressionAttributeValues: {
          ':e': evaluacion.resultado,
          ':r': { score: evaluacion.score, tasaAnual: evaluacion.tasaAnual, cuotaMensual: evaluacion.cuotaMensual, motivo: evaluacion.motivo },
          ':t': new Date().toISOString(),
        },
      }),
    );

    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: EVENT_BUS_NAME,
            Source: 'crediflow.evaluador',
            DetailType: 'SolicitudEvaluada',
            Detail: JSON.stringify({
              solicitudId: msg.solicitudId,
              nombre: msg.solicitud.nombre,
              monto: msg.solicitud.monto,
              resultado: evaluacion.resultado,
              score: evaluacion.score,
              motivo: evaluacion.motivo,
            }),
          },
        ],
      }),
    );

    metrics.addMetric('SolicitudesEvaluadas', MetricUnit.Count, 1);
    metrics.addMetric(evaluacion.resultado === 'APROBADA' ? 'SolicitudesAprobadas' : 'SolicitudesRechazadas', MetricUnit.Count, 1);
    logger.info('Solicitud evaluada', { resultado: evaluacion.resultado, score: evaluacion.score });
  } catch (err) {
    // Si falló, liberamos la marca de idempotencia para permitir el reintento de SQS
    await liberar(msg.solicitudId);
    throw err;
  }
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  metrics.addDimension('service', 'evaluador');
  const failures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      await procesar(record);
    } catch (err) {
      logger.error('Error procesando mensaje', { error: (err as Error).message });
      metrics.addMetric('ErroresEvaluacion', MetricUnit.Count, 1);
      failures.push({ itemIdentifier: record.messageId });
    } finally {
      logger.removeKeys(['solicitudId', 'messageId']);
    }
  }

  metrics.publishStoredMetrics();
  return { batchItemFailures: failures };
};
