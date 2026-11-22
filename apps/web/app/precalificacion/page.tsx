'use client';
import { useEffect, useState } from 'react';
import { precal, type Precalificacion } from '@/lib/api';
import { currentSession, login, logout, type Session } from '@/lib/auth';
import { hasCognito, hasPrecal } from '@/lib/config';

const money = (n: number) => `$${n.toLocaleString('es-SV', { minimumFractionDigits: 2 })}`;

export default function PrecalificacionPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ ingresoMensual: 1500, deudasMensuales: 200, montoSolicitado: 8000, plazoMeses: 36 });
  const [resultado, setResultado] = useState<Precalificacion | null>(null);
  const [historial, setHistorial] = useState<Precalificacion[]>([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => setSession(currentSession()), []);

  const cargarHistorial = async (s: Session) => {
    try {
      setHistorial(await precal.historial(s.idToken));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (session) void cargarHistorial(session);
  }, [session]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setError('');
    try {
      setSession(await login(email, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const calcular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setOcupado(true);
    setError('');
    try {
      const r = await precal.precalificar(session.idToken, {
        ingresoMensual: Number(form.ingresoMensual),
        deudasMensuales: Number(form.deudasMensuales),
        montoSolicitado: Number(form.montoSolicitado),
        plazoMeses: Number(form.plazoMeses),
      });
      setResultado(r);
      await cargarHistorial(session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (!hasPrecal() || !hasCognito()) {
    return (
      <>
        <h1>Precalificación</h1>
        <div className="alerta info">
          Configura <code>NEXT_PUBLIC_PRECAL_URL</code>, <code>NEXT_PUBLIC_COGNITO_USER_POOL_ID</code> y <code>NEXT_PUBLIC_COGNITO_CLIENT_ID</code> (sesión 5).
        </div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <h1>Precalificación</h1>
        <p className="sub">Inicia sesión con un usuario del User Pool de Cognito (creado por CLI en la sesión 5).</p>
        <div className="card" style={{ maxWidth: 420 }}>
          <form className="form" onSubmit={entrar} style={{ gridTemplateColumns: '1fr' }}>
            <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <div className="acciones"><button className="btn" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Iniciar sesión'}</button></div>
          </form>
          {error && <div className="alerta error">{error}</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Precalificación</h1>
      <p className="sub">Sesión de <strong>{session.email}</strong> · <a href="#" onClick={(e) => { e.preventDefault(); logout(); setSession(null); }}>cerrar sesión</a></p>

      <div className="card">
        <form className="form" onSubmit={calcular}>
          <label>Ingreso mensual (USD)<input type="number" value={form.ingresoMensual} onChange={(e) => setForm({ ...form, ingresoMensual: Number(e.target.value) })} required /></label>
          <label>Deudas mensuales (USD)<input type="number" value={form.deudasMensuales} onChange={(e) => setForm({ ...form, deudasMensuales: Number(e.target.value) })} required /></label>
          <label>Monto solicitado (USD)<input type="number" value={form.montoSolicitado} onChange={(e) => setForm({ ...form, montoSolicitado: Number(e.target.value) })} required /></label>
          <label>Plazo (meses)<input type="number" min={6} max={84} value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: Number(e.target.value) })} required /></label>
          <div className="acciones"><button className="btn" disabled={ocupado}>{ocupado ? 'Calculando…' : 'Precalificar'}</button></div>
        </form>
        {error && <div className="alerta error">{error}</div>}
      </div>

      {resultado && (
        <div className={`card panel-resultado`} style={{ marginTop: 16, borderLeftColor: resultado.elegible ? '#22c55e' : '#ef4444' }}>
          <h3>{resultado.elegible ? 'Elegible' : 'No elegible'} <span className={`badge ${resultado.elegible ? 'APROBADA' : 'RECHAZADA'}`}>{resultado.motivo}</span></h3>
          <dl className="kv">
            <dt>Relación deuda/ingreso</dt><dd>{resultado.dti} %</dd>
            <dt>Tasa anual</dt><dd>{resultado.tasaAnual} %</dd>
            <dt>Cuota estimada</dt><dd>{money(resultado.cuotaEstimada)}</dd>
            <dt>Monto máximo sugerido</dt><dd>{money(resultado.montoMaximo)}</dd>
          </dl>
        </div>
      )}

      <h2>Historial</h2>
      <table>
        <thead><tr><th>Fecha</th><th>Monto</th><th>Plazo</th><th>DTI</th><th>Resultado</th></tr></thead>
        <tbody>
          {historial.length === 0 && <tr><td colSpan={5} className="meta">Sin precalificaciones todavía.</td></tr>}
          {historial.map((h) => (
            <tr key={h.id}>
              <td className="meta">{new Date(h.creadaEn).toLocaleString('es-SV')}</td>
              <td>{money(h.montoSolicitado)}</td>
              <td>{h.plazoMeses} meses</td>
              <td>{h.dti} %</td>
              <td><span className={`badge ${h.elegible ? 'APROBADA' : 'RECHAZADA'}`}>{h.elegible ? 'ELEGIBLE' : 'NO ELEGIBLE'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
