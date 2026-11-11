/**
 * Notificador: destino Lambda de las reglas de EventBridge.
 *
 * En el curso solo escribe un log estructurado (se consulta con Logs Insights
 * en la sesión 6). En un sistema real enviaría un correo/SMS/webhook al cliente.
 */
import { Logger } from '@aws-lambda-powertools/logger';
import type { EventBridgeEvent } from 'aws-lambda';

const logger = new Logger();

interface SolicitudEvaluada {
  solicitudId: string;
  nombre: string;
  monto: number;
  resultado: 'APROBADA' | 'RECHAZADA';
  score: number;
  motivo: string;
}

export const handler = async (event: EventBridgeEvent<'SolicitudEvaluada', SolicitudEvaluada>): Promise<void> => {
  logger.info('Notificación enviada (simulada)', {
    solicitudId: event.detail.solicitudId,
    resultado: event.detail.resultado,
    monto: event.detail.monto,
    cliente: event.detail.nombre,
    regla: event.resources?.[0] ?? 'desconocida',
  });
};
