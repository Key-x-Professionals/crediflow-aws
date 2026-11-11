import { cuotaMensual, precalificar } from './motor';

describe('motor de precalificación', () => {
  it('calcula la cuota con el sistema francés', () => {
    // 10,000 a 12 meses al 12 % anual ≈ 888.49
    expect(cuotaMensual(10000, 12, 12)).toBeCloseTo(888.49, 1);
  });

  it('aprueba cuando el DTI es menor o igual a 40 %', () => {
    const r = precalificar({ ingresoMensual: 2000, deudasMensuales: 200, montoSolicitado: 5000, plazoMeses: 24 });
    expect(r.elegible).toBe(true);
    expect(r.dti).toBeLessThanOrEqual(40);
  });

  it('rechaza cuando el DTI supera 40 %', () => {
    const r = precalificar({ ingresoMensual: 800, deudasMensuales: 300, montoSolicitado: 20000, plazoMeses: 12 });
    expect(r.elegible).toBe(false);
    expect(r.motivo).toContain('deuda/ingreso');
  });

  it('rechaza ingresos menores al mínimo', () => {
    const r = precalificar({ ingresoMensual: 300, deudasMensuales: 0, montoSolicitado: 500, plazoMeses: 12 });
    expect(r.elegible).toBe(false);
    expect(r.montoMaximo).toBe(0);
  });
});
