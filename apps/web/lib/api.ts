/** Cliente HTTP de CrediFlow: operaciones finitas contra los dos backends. */
import { config } from './config';

export type Estado = 'RECIBIDA' | 'EN_EVALUACION' | 'APROBADA' | 'RECHAZADA';

export interface Solicitud {
  id: string;
  nombre: string;
  documento: string;
  monto: number;
  plazoMeses: number;
  ingresoMensual: number;
  proposito: string;
  estado: Estado;
  resultado?: { score: number; tasaAnual: number; cuotaMensual: number; motivo: string };
  creadaEn: string;
  actualizadaEn: string;
}

export interface Health {
  status: string;
  storage?: string;
  database?: string;
  queue?: string;
  uptimeSeconds?: number;
}

export interface Info {
  service: string;
  version: string;
  student: string;
  env: string;
  region: string;
  hostname: string;
}

async function http<T>(url: string, init?: RequestInit, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error ?? `HTTP ${res.status}`;
      const detalles = body?.detalles ? ' ' + JSON.stringify(body.detalles) : '';
      throw new Error(msg + detalles);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---- API de solicitudes (contenedores) --------------------------------------
export const api = {
  health: () => http<Health>(`${config.apiUrl}/health`),
  info: () => http<Info>(`${config.apiUrl}/info`),
  listar: () => http<Solicitud[]>(`${config.apiUrl}/solicitudes`),
  obtener: (id: string) => http<Solicitud>(`${config.apiUrl}/solicitudes/${id}`),
  crear: (data: Omit<Solicitud, 'id' | 'estado' | 'creadaEn' | 'actualizadaEn' | 'resultado'>) =>
    http<Solicitud>(`${config.apiUrl}/solicitudes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ---- API de precalificación (serverless) ------------------------------------
export interface PrecalInput {
  ingresoMensual: number;
  deudasMensuales: number;
  montoSolicitado: number;
  plazoMeses: number;
}

export interface Precalificacion extends PrecalInput {
  id: string;
  creadaEn: string;
  elegible: boolean;
  dti: number;
  tasaAnual: number;
  cuotaEstimada: number;
  montoMaximo: number;
  motivo: string;
}

export const precal = {
  health: () => http<{ status: string }>(`${config.precalUrl}/health`),
  precalificar: (token: string, data: PrecalInput) =>
    http<Precalificacion>(`${config.precalUrl}/precalificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  historial: (token: string) =>
    http<Precalificacion[]>(`${config.precalUrl}/precalificaciones`, { headers: { Authorization: `Bearer ${token}` } }),
};
