/**
 * Motor de precalificación (ficticio y determinista para poder probarlo).
 *
 * Regla principal: relación deuda/ingreso (DTI). Con la cuota estimada del
 * nuevo crédito, el DTI total no debe superar 40 %.
 */
import { z } from 'zod';

export const PrecalificacionInputSchema = z.object({
  ingresoMensual: z.number().positive().max(50000),
  deudasMensuales: z.number().min(0).max(50000),
  montoSolicitado: z.number().positive().max(100000),
  plazoMeses: z.number().int().min(6).max(84),
});

export type PrecalificacionInput = z.infer<typeof PrecalificacionInputSchema>;

export interface PrecalificacionResultado {
  elegible: boolean;
  dti: number;
  tasaAnual: number;
  cuotaEstimada: number;
  montoMaximo: number;
  motivo: string;
}

export function cuotaMensual(monto: number, plazoMeses: number, tasaAnual: number): number {
  const i = tasaAnual / 100 / 12;
  const cuota = (monto * i) / (1 - Math.pow(1 + i, -plazoMeses));
  return Math.round(cuota * 100) / 100;
}

export function tasaPorPlazo(plazoMeses: number): number {
  if (plazoMeses <= 12) return 12;
  if (plazoMeses <= 36) return 14.5;
  if (plazoMeses <= 60) return 16;
  return 18;
}

export function precalificar(input: PrecalificacionInput): PrecalificacionResultado {
  const tasaAnual = tasaPorPlazo(input.plazoMeses);
  const cuotaEstimada = cuotaMensual(input.montoSolicitado, input.plazoMeses, tasaAnual);
  const dti = Math.round(((input.deudasMensuales + cuotaEstimada) / input.ingresoMensual) * 1000) / 10;

  // Capacidad de pago disponible hasta el 40 % del ingreso
  const capacidad = Math.max(0, input.ingresoMensual * 0.4 - input.deudasMensuales);
  const i = tasaAnual / 100 / 12;
  const montoMaximo = Math.max(0, Math.floor((capacidad * (1 - Math.pow(1 + i, -input.plazoMeses))) / i));

  if (input.ingresoMensual < 400) {
    return { elegible: false, dti, tasaAnual, cuotaEstimada, montoMaximo: 0, motivo: 'Ingreso mensual por debajo del mínimo (USD 400).' };
  }
  if (dti > 40) {
    return { elegible: false, dti, tasaAnual, cuotaEstimada, montoMaximo, motivo: `Relación deuda/ingreso de ${dti} % supera el 40 % permitido.` };
  }
  return { elegible: true, dti, tasaAnual, cuotaEstimada, montoMaximo, motivo: 'Cumple con la capacidad de pago.' };
}
