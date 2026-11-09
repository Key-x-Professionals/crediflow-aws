/**
 * Motor de evaluación de solicitudes (ficticio, determinista).
 *
 * Score de 300 a 850 construido a partir de:
 *   - relación cuota/ingreso
 *   - monto respecto al ingreso anual
 *   - propósito (vivienda y educación puntúan mejor)
 * Se aprueba con score >= 600.
 */
export interface SolicitudEvaluable {
  monto: number;
  plazoMeses: number;
  ingresoMensual: number;
  proposito: string;
}

export interface Evaluacion {
  resultado: 'APROBADA' | 'RECHAZADA';
  score: number;
  tasaAnual: number;
  cuotaMensual: number;
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

export function evaluar(s: SolicitudEvaluable): Evaluacion {
  const tasaAnual = tasaPorPlazo(s.plazoMeses);
  const cuota = cuotaMensual(s.monto, s.plazoMeses, tasaAnual);
  const cuotaIngreso = cuota / s.ingresoMensual; // 0.1 = 10 %
  const montoIngresoAnual = s.monto / (s.ingresoMensual * 12);

  let score = 850;
  score -= Math.min(350, Math.round(cuotaIngreso * 1000)); // 30 % de cuota/ingreso resta 300
  score -= Math.min(150, Math.round(montoIngresoAnual * 100)); // monto = 1 año de ingreso resta 100
  if (s.proposito === 'vivienda' || s.proposito === 'educacion') score += 40;
  if (s.proposito === 'consumo') score -= 20;
  score = Math.max(300, Math.min(850, score));

  if (cuotaIngreso > 0.4) {
    return { resultado: 'RECHAZADA', score, tasaAnual, cuotaMensual: cuota, motivo: `La cuota representa ${Math.round(cuotaIngreso * 100)} % del ingreso (máximo 40 %).` };
  }
  if (score < 600) {
    return { resultado: 'RECHAZADA', score, tasaAnual, cuotaMensual: cuota, motivo: `Score ${score} por debajo del mínimo (600).` };
  }
  return { resultado: 'APROBADA', score, tasaAnual, cuotaMensual: cuota, motivo: `Score ${score}: capacidad de pago adecuada.` };
}
