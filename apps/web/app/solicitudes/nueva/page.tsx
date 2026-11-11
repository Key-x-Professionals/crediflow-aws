'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { hasApi } from '@/lib/config';

const ejemplo = {
  nombre: 'Ana Pérez',
  documento: '01234567-8',
  monto: 5000,
  plazoMeses: 24,
  ingresoMensual: 1200,
  proposito: 'consumo',
};

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [form, setForm] = useState(ejemplo);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const s = await api.crear({
        ...form,
        monto: Number(form.monto),
        plazoMeses: Number(form.plazoMeses),
        ingresoMensual: Number(form.ingresoMensual),
      });
      router.push(`/solicitudes?nueva=${s.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (!hasApi()) {
    return (
      <>
        <h1>Nueva solicitud</h1>
        <div className="alerta info">Configura <code>NEXT_PUBLIC_API_URL</code> para conectar la API de solicitudes.</div>
      </>
    );
  }

  return (
    <>
      <h1>Nueva solicitud de crédito</h1>
      <p className="sub">Datos ficticios. La API valida la entrada y responde con el estado inicial.</p>
      <div className="card">
        <form className="form" onSubmit={enviar}>
          <label>Nombre completo<input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required /></label>
          <label>DUI (ficticio, 00000000-0)<input value={form.documento} onChange={(e) => set('documento', e.target.value)} pattern="\d{8}-\d" required /></label>
          <label>Monto solicitado (USD)<input type="number" min={100} max={100000} value={form.monto} onChange={(e) => set('monto', e.target.value)} required /></label>
          <label>Plazo (meses)<input type="number" min={6} max={84} value={form.plazoMeses} onChange={(e) => set('plazoMeses', e.target.value)} required /></label>
          <label>Ingreso mensual (USD)<input type="number" min={1} max={50000} value={form.ingresoMensual} onChange={(e) => set('ingresoMensual', e.target.value)} required /></label>
          <label>Propósito
            <select value={form.proposito} onChange={(e) => set('proposito', e.target.value)}>
              {['consumo', 'vivienda', 'vehiculo', 'negocio', 'educacion'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div className="acciones">
            <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Registrar solicitud'}</button>
            <button className="btn secundario" type="button" onClick={() => setForm(ejemplo)}>Restablecer ejemplo</button>
          </div>
        </form>
        {error && <div className="alerta error">{error}</div>}
      </div>
    </>
  );
}
