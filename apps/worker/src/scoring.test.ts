import { evaluar } from './scoring';

describe('evaluar', () => {
  it('aprueba una solicitud razonable', () => {
    const r = evaluar({ monto: 5000, plazoMeses: 24, ingresoMensual: 1500, proposito: 'vivienda' });
    expect(r.resultado).toBe('APROBADA');
    expect(r.score).toBeGreaterThanOrEqual(600);
  });

  it('rechaza cuando la cuota supera el 40 % del ingreso', () => {
    const r = evaluar({ monto: 30000, plazoMeses: 12, ingresoMensual: 1000, proposito: 'consumo' });
    expect(r.resultado).toBe('RECHAZADA');
    expect(r.motivo).toContain('cuota');
  });

  it('es determinista', () => {
    const a = evaluar({ monto: 8000, plazoMeses: 36, ingresoMensual: 2000, proposito: 'negocio' });
    const b = evaluar({ monto: 8000, plazoMeses: 36, ingresoMensual: 2000, proposito: 'negocio' });
    expect(a).toEqual(b);
  });
});
