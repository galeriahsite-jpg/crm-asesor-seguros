"use client";
// ============================================================
// LUMO · Embudo Flash · Landing pública de solicitud
// - Copy honesto: no promete cotización automática ni tiempos
//   de respuesta que puedan incumplirse.
// - Captura UTM de la URL y los envía a la API.
// - Honeypot oculto (campo "sitio_web").
// - Consentimiento con enlace real al aviso de privacidad y
//   versión registrada en servidor.
// ============================================================
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '../components/lumo';

const INTERESES = ['Vida', 'Gastos Médicos', 'Auto', 'Hogar', 'Retiro'];

function FormularioSolicitud() {
  const searchParams = useSearchParams();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [interes, setInteres] = useState('');
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
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefono,
          interes,
          consentimiento,
          sitio_web: honeypot, // honeypot: los humanos no lo ven ni lo llenan
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
          Un asesor revisará tu solicitud y se comunicará contigo por WhatsApp.
        </p>
        <p className="font-hand text-lg text-ink-faint mt-4">gracias por tu confianza</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="lumo-card relative p-6 space-y-4">
      <span className="lumo-tape"></span>

      <div>
        <label className="block text-sm font-semibold text-ink-soft mb-1">Tu nombre</label>
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
        <label className="block text-sm font-semibold text-ink-soft mb-1">Tu WhatsApp</label>
        <input
          type="tel"
          value={telefono}
          onChange={e => setTelefono(e.target.value)}
          required
          placeholder="10 dígitos"
          className="lumo-input"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-soft mb-1">¿Qué seguro te interesa?</label>
        <select
          value={interes}
          onChange={e => setInteres(e.target.value)}
          required
          className="lumo-input"
        >
          <option value="">Selecciona una opción...</option>
          {INTERESES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

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
          y autorizo que un asesor me contacte por WhatsApp.
        </span>
      </label>

      {error && (
        <p className="text-rojo text-sm font-medium bg-rojo-soft rounded-lg p-3">{error}</p>
      )}

      <button type="submit" disabled={enviando} className="w-full lumo-btn-primary py-3.5 disabled:opacity-50">
        {enviando ? 'Enviando...' : 'Solicitar información'}
      </button>

      <p className="text-xs text-ink-faint text-center">
        Sin costo y sin compromiso. Tus datos solo se usan para contactarte.
      </p>
    </form>
  );
}

export default function Solicitud() {
  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-10">

      <header className="text-center mb-8">
        <div className="w-14 h-14 bg-azul rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
          <Icon name="shield" size={28} />
        </div>
        <p className="font-hand text-xl text-ink-soft leading-none mb-2">protege lo que más importa</p>
        <h1 className="text-3xl font-bold text-ink tracking-tight">
          Solicita información en menos de un minuto
        </h1>
        <p className="text-ink-soft mt-3">
          Recibe orientación sobre tu seguro con un asesor certificado, sin costo.
        </p>
      </header>

      <Suspense fallback={<div className="lumo-card p-6 text-center font-hand text-xl text-ink-faint">cargando...</div>}>
        <FormularioSolicitud />
      </Suspense>

      <div className="mt-8 space-y-3">
        {[
          ['Atención personal', 'Te atiende un asesor real, no un call center.'],
          ['Comparativa clara', 'Opciones de distintas aseguradoras explicadas en simple.'],
          ['Sin presión', 'Tú decides los tiempos. Nosotros te orientamos.'],
        ].map(([titulo, texto]) => (
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
