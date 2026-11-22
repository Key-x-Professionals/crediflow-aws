'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Solicitud } from '@/lib/api';
import { hasApi } from '@/lib/config';

const money = (n: number) => `$${n.toLocaleString('es-SV', { minimumFractionDigits: 2 })}`;

export default function SolicitudesPage() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [sel, setSel] = useState<Solicitud | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    if (!hasApi()) return;
    setCargando(true);
    try {
      setItems(await api.listar());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
    const t = setInterval(cargar, 5000); // refresco automático: se ve cambiar el estado en vivo
    return () => clearInterval(t);
  }, []);

  if (!hasApi()) {
    return (
      <>
        <h1>Solicitudes</h1>
        <div className="alerta info">Configura <code>NEXT_PUBLIC_API_URL</code> para conectar la API de solicitudes.</div>
      </>
    );
  }

  return (
    <>
      <h1>Solicitudes de crédito</h1>
      <p className="sub">Se actualiza cada 5 segundos. Haz clic en una fila para ver el detalle.</p>
      <div className="acciones" style={{ marginBottom: 16 }}>
        <button className="btn secundario sm" onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</button>
        <Link className="btn sm" href="/solicitudes/nueva">Nueva solicitud</Link>
      </div>
      {error && <div className="alerta error">{error}</div>}

      <table>
        <thead>
          <tr><th>Cliente</th><th>Monto</th><th>Plazo</th><th>Propósito</th><th>Estado</th><th>Creada</th></tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={6} className="meta">Aún no hay solicitudes.</td></tr>}
          {items.map((s) => (
            <tr key={s.id} className="click" onClick={() => setSel(s)}>
              <td>{s.nombre}</td>
              <td>{money(s.monto)}</td>
              <td>{s.plazoMeses} meses</td>
              <td>{s.proposito}</td>
              <td><span className={`badge ${s.estado}`}>{s.estado.replace('_', ' ')}</span></td>
              <td className="meta">{new Date(s.creadaEn).toLocaleString('es-SV')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sel && (
        <div className="card panel-resultado" style={{ marginTop: 20 }}>
          <h3>Solicitud <code>{sel.id}</code> <span className={`badge ${sel.estado}`}>{sel.estado.replace('_', ' ')}</span></h3>
          <dl className="kv">
            <dt>Cliente</dt><dd>{sel.nombre} ({sel.documento})</dd>
            <dt>Monto</dt><dd>{money(sel.monto)} a {sel.plazoMeses} meses</dd>
            <dt>Ingreso mensual</dt><dd>{money(sel.ingresoMensual)}</dd>
            <dt>Propósito</dt><dd>{sel.proposito}</dd>
            {sel.resultado && (
              <>
                <dt>Score</dt><dd>{sel.resultado.score}</dd>
                <dt>Tasa anual</dt><dd>{sel.resultado.tasaAnual} %</dd>
                <dt>Cuota mensual</dt><dd>{money(sel.resultado.cuotaMensual)}</dd>
                <dt>Motivo</dt><dd>{sel.resultado.motivo}</dd>
              </>
            )}
            <dt>Última actualización</dt><dd>{new Date(sel.actualizadaEn).toLocaleString('es-SV')}</dd>
          </dl>
          {sel.estado === 'RECIBIDA' && <div className="alerta info">Sin cola de evaluación configurada: la solicitud queda registrada pero no se evalúa (hasta la sesión 5).</div>}
          {sel.estado === 'EN_EVALUACION' && <div className="alerta info">El worker está evaluando la solicitud. Esta vista se refresca sola.</div>}
        </div>
      )}
    </>
  );
}
