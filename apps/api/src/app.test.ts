import request from 'supertest';
import { createApp } from './app';
import { MemoryStorage } from './storage';

const solicitud = {
  nombre: 'Ana Pérez',
  documento: '01234567-8',
  monto: 5000,
  plazoMeses: 24,
  ingresoMensual: 1200,
  proposito: 'consumo',
};

describe('CrediFlow API', () => {
  const app = createApp({ storage: new MemoryStorage() });

  it('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.queue).toBe('not-configured');
  });

  it('POST /solicitudes crea una solicitud RECIBIDA cuando no hay cola', async () => {
    const res = await request(app).post('/solicitudes').send(solicitud);
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('RECIBIDA');
    expect(res.body.id).toBeDefined();
  });

  it('POST /solicitudes valida la entrada', async () => {
    const res = await request(app).post('/solicitudes').send({ ...solicitud, documento: 'malo' });
    expect(res.status).toBe(400);
    expect(res.body.detalles.documento).toBeDefined();
  });

  it('GET /solicitudes/:id devuelve 404 si no existe', async () => {
    const res = await request(app).get('/solicitudes/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
