import { sanitizeStudent } from '../lib/config';

describe('sanitizeStudent', () => {
  it('convierte puntos y mayúsculas a formato nombre-apellido', () => {
    expect(sanitizeStudent('Edgar.Velasco')).toBe('edgar-velasco');
    expect(sanitizeStudent('juan__perez')).toBe('juan-perez');
    expect(sanitizeStudent('  ana ')).toBe('ana');
  });

  it('recorta a 14 caracteres cortando en el último guion', () => {
    expect(sanitizeStudent('maria.jose.perez.gomez')).toBe('maria-jose');
    expect(sanitizeStudent('abc.def.ghi.jkl.mno')).toBe('abc-def-ghi');
  });

  it('recorta a 14 cuando no hay guion donde cortar', () => {
    expect(sanitizeStudent('verylongnameicecream')).toBe('verylongnameic');
  });

  it('lanza error si no queda ningún carácter válido', () => {
    expect(() => sanitizeStudent('...')).toThrow();
  });
});
