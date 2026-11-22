'use client';
/**
 * Panel de estado: muestra qué partes de CrediFlow ya "cobraron vida".
 * Cada sesión del curso enciende una tarjeta más.
 */
import { useEffect, useState } from 'react';
import { api, precal, type Health, type Info } from '@/lib/api';
import { config, hasApi, hasCognito, hasPrecal } from '@/lib/config';

type Estado = 'off' | 'wait' | 'ok' | 'err';

export default function EstadoPage() {
  const [apiEstado, setApiEstado] = useState<Estado>(hasApi() ? 'wait' : 'off');
  const [health, setHealth] = useState<Health | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [apiError, setApiError] = useState('');
  const [precalEstado, setPrecalEstado] = useState<Estado>(hasPrecal() ? 'wait' : 'off');
  const [precalError, setPrecalError] = useState('');

  const revisar = async () => {
    if (hasApi()) {
      setApiEstado('wait');
      try {
        const [h, i] = await Promise.all([api.health(), api.info()]);
        setHealth(h);
        setInfo(i);
        setApiEstado(h.status === 'ok' ? 'ok' : 'err');
        setApiError(h.status === 'ok' ? '' : 'La API responde pero está degradada (revisa la base de datos).');
      } catch (e) {
        setApiEstado('err');
        setApiError((e as Error).message);
      }
    }
    if (hasPrecal()) {
      setPrecalEstado('wait');
      try {
        await precal.health();
        setPrecalEstado('ok');
        setPrecalError('');
      } catch (e) {
        setPrecalEstado('err');
        setPrecalError((e as Error).message);
      }
    }
  };

  useEffect(() => {
    void revisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colaOk = health?.queue === 'configured';

  return (
    <>
      <h1>Estado de CrediFlow</h1>
      <p className="sub">Cada tarjeta se enciende cuando el backend correspondiente está desplegado y conectado.</p>
      <div className="acciones" style={{ marginBottom: 16 }}>
        <button className="btn secundario sm" onClick={revisar}>Volver a revisar</button>
      </div>

      <div className="grid">
        <div className="card">
          <h3><span className={`dot ${apiEstado}`} /> API de solicitudes (contenedores)</h3>
          {!hasApi() && <p className="meta">Configura <code>NEXT_PUBLIC_API_URL</code> en <code>apps/web/.env.local</code>. Se construye en las sesiones 2 a 4.</p>}
          {hasApi() && (
            <>
              <p className="meta"><code>{config.apiUrl}</code></p>
              {apiError && <div className="alerta error">{apiError}</div>}
              {health && (
                <dl className="kv">
                  <dt>Almacenamiento</dt><dd>{health.storage}</dd>
                  <dt>Base de datos</dt><dd>{health.database}</dd>
                  <dt>Cola de evaluación</dt><dd>{colaOk ? 'configurada' : 'sin configurar'}</dd>
                  <dt>Versión</dt><dd>{info?.version}</dd>
                  <dt>Alumno / entorno</dt><dd>{info?.student} / {info?.env}</dd>
                  <dt>Host</dt><dd>{info?.hostname}</dd>
                </dl>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h3><span className={`dot ${colaOk ? 'ok' : hasApi() ? 'off' : 'off'}`} /> Evaluación asíncrona (cola + eventos)</h3>
          <p className="meta">
            {colaOk
              ? 'La API encola cada solicitud; el worker la evalúa y el bus de eventos notifica el resultado.'
              : 'Se activa en la sesión 5 cuando la API recibe QUEUE_URL. Hasta entonces las solicitudes quedan RECIBIDAS.'}
          </p>
        </div>

        <div className="card">
          <h3><span className={`dot ${precalEstado}`} /> API de precalificación (serverless)</h3>
          {!hasPrecal() && <p className="meta">Configura <code>NEXT_PUBLIC_PRECAL_URL</code>. Se construye en la sesión 5.</p>}
          {hasPrecal() && <p className="meta"><code>{config.precalUrl}</code></p>}
          {precalError && <div className="alerta error">{precalError}</div>}
        </div>

        <div className="card">
          <h3><span className={`dot ${hasCognito() ? 'ok' : 'off'}`} /> Autenticación (Cognito)</h3>
          <p className="meta">
            {hasCognito()
              ? <>User pool <code>{config.userPoolId}</code> en <code>{config.region}</code></>
              : <>Configura <code>NEXT_PUBLIC_COGNITO_USER_POOL_ID</code> y <code>NEXT_PUBLIC_COGNITO_CLIENT_ID</code> (sesión 5).</>}
          </p>
        </div>
      </div>

      <h2>Ruta del curso</h2>
      <div className="card">
        <ol className="pasos">
          <li className={hasApi() ? 'done' : ''}>Sesión 2 · API corriendo en EC2 + RDS (despliegue manual)</li>
          <li className={hasApi() && health?.storage === 'postgres' ? 'done' : ''}>Sesión 3 · Red y base de datos con CDK + pipeline OIDC</li>
          <li className={apiEstado === 'ok' && info?.env !== 'local' ? 'done' : ''}>Sesión 4 · API en ECS Fargate detrás de un ALB con autoscaling</li>
          <li className={colaOk && precalEstado === 'ok' ? 'done' : ''}>Sesión 5 · Cola, worker, eventos y API serverless con Cognito</li>
          <li>Sesión 6 · WAF, GuardDuty, dashboard, alarmas y simulacro de incidente</li>
        </ol>
      </div>
    </>
  );
}
