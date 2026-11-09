/**
 * Modelo de dominio de CrediFlow (ficticio).
 *
 * Una solicitud nace RECIBIDA. Si existe una cola de evaluación pasa a
 * EN_EVALUACION y el worker la deja en APROBADA o RECHAZADA.
 */
import { z } from 'zod';

export const ESTADOS = ['RECIBIDA', 'EN_EVALUACION', 'APROBADA', 'RECHAZADA'] as const;
export type Estado = (typeof ESTADOS)[number];

export const PROPOSITOS = ['consumo', 'vivienda', 'vehiculo', 'negocio', 'educacion'] as const;

export const NuevaSolicitudSchema = z.object({
  nombre: z.string().min(3).max(120),
  documento: z.string().regex(/^\d{8}-\d$/, 'Formato esperado: 00000000-0 (DUI ficticio)'),
  monto: z.number().positive().max(100000),
  plazoMeses: z.number().int().min(6).max(84),
  ingresoMensual: z.number().positive().max(50000),
  proposito: z.enum(PROPOSITOS),
});

export type NuevaSolicitud = z.infer<typeof NuevaSolicitudSchema>;

export interface Solicitud extends NuevaSolicitud {
  id: string;
  estado: Estado;
  resultado?: {
    score: number;
    tasaAnual: number;
    cuotaMensual: number;
    motivo: string;
  };
  creadaEn: string;
  actualizadaEn: string;
}

/** Cuota mensual (sistema francés) */
export function cuotaMensual(monto: number, plazoMeses: number, tasaAnual: number): number {
  const i = tasaAnual / 100 / 12;
  if (i === 0) return monto / plazoMeses;
  const cuota = (monto * i) / (1 - Math.pow(1 + i, -plazoMeses));
  return Math.round(cuota * 100) / 100;
}
