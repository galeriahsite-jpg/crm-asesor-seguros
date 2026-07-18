"use client";
// ============================================================
// LUMO · Landing reutilizable de captura de leads
// - Mismo estilo y seguridad que /solicitud (honeypot, UTM,
//   consentimiento versionado, envío a /api/leads).
// - Configurable por producto: campos extra van en `detalles`
//   y el servidor los serializa en nota_entrada_web.
// ============================================================
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon, type IconName } from './lumo';
import TelefonoInput from './TelefonoInput';
import type { PaisTelefono } from '../lib/telefono';

export type CampoExtra = {
  clave: string;
  etiqueta: string;
  tipo?: 'text' | 'number' | 'tel';
  opciones?: string[];          // si viene, se renderiza un <select>
  placeholder?: string;
  requerido?: boolean;
};

export type LandingConfig = {
  icono: IconName;              // nombre de Icon (shield, star, heart, ...)
  kicker: string;               // línea font-hand arriba del título
  titulo: string;
  subtitulo: string;
  interes: string;              // valor fijo enviado a la API
  opcionesInteres?: string[];   // si viene, el prospecto elige el interés
  etiquetaInteres?: string;
  etiquetaNombre?: string;
  etiquetaTelefono?: string;
  campos?: CampoExtra[];
  textoBoton?: string;
  textoConsentimiento?: string;
  textoExito?: string;
  bullets: [string, string][];
};

function Formulario({ config }: { config: LandingConfig }) {
  const searchParams = useSearchParams();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefonoPais, setTelefonoPais] = useState<PaisTelefono>('MX');
  const [interes, setInteres] = useState(config.opcionesInteres ? '' : config.interes);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [consentimiento, setConsentimiento] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const detalles: Record<string, string> = {};
      for (const c of config.campos || []) {
        const v = (extras[c.clave] || '').trim();
        if (v) detalles[c.etiqueta] = v;
      }
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefono,
          telefono_pais: telefonoPais,
          interes,
          consentimiento,
          sitio_web: honeypot, // honeypot: los humanos no lo ven ni lo llenan
          detalles: Object.keys(detalles).length ? detalles : undefined,
          utm_source: searchParams.get('utm_source') || undefined,
          utm_medium: searchParams.get('utm_medium') || undefined,
          utm_campaign: searchParams.get('utm_campaign') || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No pudimos registrar tu solicitud. Intenta de nuevo.');
      } else {
        setEnviado(true);
      }
    } catch {
      setError('Error de conexión. Revisa tu internet e intenta de nuevo.');
    }
    setEnviando(false);
  }

  if (enviado) {
    return (
      <div className="lumo-card relative p-8 text-center">
        <span className="lumo-tape"></span>
        <div className="w-14 h-14 bg-verde-soft text-verde rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon name="check" size={30} />
        </div>
        <h2 className="text-2xl font-bold text-ink">¡Solicitud recibida!</h2>
        <p className="text-ink-soft mt-3">
          {config.textoExito || 'Un asesor revisará tu solicitud y se comunicará contigo por WhatsApp.'}
        </p>
        <p className="font-hand text-lg text-ink-faint mt-4">gracias por tu confianza</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="lumo-card relative p-6 space-y-4">
      <span className="lumo-tape"></span>

      <div>
        <label className="block text-sm font-semibold text-ink-soft mb-1">
          {config.etiquetaNombre || 'Tu nombre'}
        </label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          placeholder="Nombre y apellido"
          className="lumo-input"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-soft mb-1">
          {config.etiquetaTelefono || 'Tu WhatsApp'}
        </label>
        <TelefonoInput value={telefono} onChange={setTelefono} pais={telefonoPais} onChangePais={setTelefonoPais} required />
      </div>

      {config.opcionesInteres && (
        <div>
          <label className="block text-sm font-semibold text-ink-soft mb-1">
            {config.etiquetaInteres || '¿Qué seguro te interesa?'}
          </label>
          <select value={interes} onChange={e => setInteres(e.target.value)} required className="lumo-input">
            <option value="">Selecciona una opción...</option>
            {config.opcionesInteres.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      )}

      {(config.campos || []).map(c => (
        <div key={c.clave}>
          <label className="block text-sm font-semibold text-ink-soft mb-1">{c.etiqueta}</label>
          {c.opciones ? (
            <select
              value={extras[c.clave] || ''}
              onChange={e => setExtras({ ...extras, [c.clave]: e.target.value })}
              required={c.requerido !== false}
              className="lumo-input"
            >
              <option value="">Selecciona una opción...</option>
              {c.opciones.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={c.tipo || 'text'}
              value={extras[c.clave] || ''}
              onChange={e => setExtras({ ...extras, [c.clave]: e.target.value })}
              required={c.requerido !== false}
              maxLength={120}
              placeholder={c.placeholder}
              className="lumo-input"
            />
          )}
        </div>
      ))}

      {/* Honeypot: invisible para personas, irresistible para bots */}
      <div className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          No llenes este campo
          <input
            type="text"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-soft cursor-pointer">
        <input
          type="checkbox"
          checked={consentimiento}
          onChange={e => setConsentimiento(e.target.checked)}
          required
          className="mt-0.5 accent-[#1F3FD8] w-4 h-4"
        />
        <span>
          He leído el{' '}
          <Link href="/aviso-de-privacidad" target="_blank" className="text-azul font-semibold underline">
            aviso de privacidad
          </Link>{' '}
          {config.textoConsentimiento || 'y autorizo que un asesor me contacte por WhatsApp.'}
        </span>
      </label>

      {error && (
        <p className="text-rojo text-sm font-medium bg-rojo-soft rounded-lg p-3">{error}</p>
      )}

      <button type="submit" disabled={enviando} className="w-full lumo-btn-primary py-3.5 disabled:opacity-50">
        {enviando ? 'Enviando...' : (config.textoBoton || 'Solicitar información')}
      </button>

      <p className="text-xs text-ink-faint text-center">
        Sin costo y sin compromiso. Tus datos solo se usan para contactarte.
      </p>
    </form>
  );
}

export default function LandingLead({ config }: { config: LandingConfig }) {
  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-10">

      <header className="text-center mb-8">
        <div className="w-14 h-14 bg-azul rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
          <Icon name={config.icono} size={28} />
        </div>
        <p className="font-hand text-xl text-ink-soft leading-none mb-2">{config.kicker}</p>
        <h1 className="text-2xl font-bold text-ink tracking-tight">{config.titulo}</h1>
        <p className="text-ink-soft mt-3">{config.subtitulo}</p>
      </header>

      <Suspense fallback={<div className="lumo-card p-6 text-center font-hand text-xl text-ink-faint">cargando...</div>}>
        <Formulario config={config} />
      </Suspense>

      <div className="mt-8 space-y-3">
        {config.bullets.map(([titulo, texto]) => (
          <div key={titulo} className="flex gap-3 items-start">
            <Icon name="check" size={18} className="text-azul mt-0.5 shrink-0" />
            <p className="text-sm text-ink-soft"><b className="text-ink">{titulo}.</b> {texto}</p>
          </div>
        ))}
      </div>

      <p className="font-hand text-lg text-ink-faint text-center mt-10">
        hecho para pensar mejor, recordar más y vivir con <span className="text-rojo">intención</span>.
      </p>
    </div>
  );
}
