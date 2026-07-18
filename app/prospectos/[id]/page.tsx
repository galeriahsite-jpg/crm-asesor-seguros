"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BottomNav, Icon } from '../../components/lumo';
import {
  registrarActividad, sellarPrimerContacto, tiempoTranscurrido,
  ETIQUETAS_ACTIVIDAD, type Actividad,
} from '../../lib/actividades';

type Cita = { id: string; fecha: string; hora: string; tipo: string; estado: string };
type Oportunidad = { id: string; producto: string; aseguradora: string; prima: string; estado: string };
type Diagnostico = {
  id: string;
  que_proteger: string;
  riesgo_preocupante: string;
  producto_posible: string;
  aseguradoras_consultar: string;
  fecha_decision: string;
  nota: string;
  producto_sugerido?: string;
};

export default function FichaProspecto() {
  const params = useParams();
  const router = useRouter();
  const prospectoId = params.id as string;

  const [prospecto, setProspecto] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [registrandoResultado, setRegistrandoResultado] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);

  const [nuevaAccion, setNuevaAccion] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');

  const [mostrarFormCita, setMostrarFormCita] = useState(false);
  const [citaFecha, setCitaFecha] = useState('');
  const [citaHora, setCitaHora] = useState('');
  const [citaTipo, setCitaTipo] = useState('Llamada');

  const [mostrarFormDiag, setMostrarFormDiag] = useState(false);
  const [dProteger, setDProteger] = useState('');
  const [dRiesgo, setDRiesgo] = useState('');
  const [dProductoPosible, setDProductoPosible] = useState('');
  const [dAseguradoras, setDAseguradoras] = useState('');
  const [dFechaDecision, setDFechaDecision] = useState('');
  const [dProximaAccion, setDProximaAccion] = useState('');

  const [mostrarFormOpp, setMostrarFormOpp] = useState(false);
  const [oppProducto, setOppProducto] = useState('Vida');
  const [oppAseguradora, setOppAseguradora] = useState('AXA');
  const [oppPrima, setOppPrima] = useState('');

  // Mensaje de primer contacto generado por LUMO (borrador editable)
  const [mensajeIA, setMensajeIA] = useState('');
  const [generandoMsg, setGenerandoMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function generarMensajeIA() {
    setGenerandoMsg(true);
    setErrorMsg('');
    setMensajeIA('');
    try {
      // La API solo recibe el ID; los datos reales los lee del CRM con tu sesión.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErrorMsg('Tu sesión ha expirado.'); setGenerandoMsg(false); return; }

      const res = await fetch('/api/generar-mensaje', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prospectoId }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'No se pudo generar el mensaje.');
      else {
        setMensajeIA(data.mensaje);
        void registrarActividad({
          tipo: 'mensaje_generado',
          descripcion: 'Borrador de primer contacto generado con LUMO',
          prospecto_id: prospectoId,
        });
      }
    } catch {
      setErrorMsg('Error de conexión.');
    }
    setGenerandoMsg(false);
  }

  useEffect(() => {
    if (prospectoId) cargarFicha(prospectoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectoId]);

  async function cargarFicha(id: string) {
    setCargando(true);
    const { data: prospData } = await supabase.from('prospectos').select('*').eq('id', id).single();
    if (prospData) {
      setProspecto(prospData);
      const { data: cit } = await supabase.from('citas').select('*').eq('prospecto_id', id);
      if (cit) setCitas(cit as Cita[]);
      const { data: ops } = await supabase.from('oportunidades').select('*').eq('prospecto_id', id);
      if (ops) setOportunidades(ops as Oportunidad[]);
      const { data: diags } = await supabase.from('diagnosticos').select('*').eq('prospecto_id', id);
      if (diags) setDiagnosticos(diags as Diagnostico[]);
      const { data: acts } = await supabase.from('actividades')
        .select('id, tipo, descripcion, metadata, created_at')
        .eq('prospecto_id', id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (acts) setActividades(acts as Actividad[]);
    }
    setCargando(false);
  }

  // ── Registro post-llamada de 1 toque (cierra el circuito) ──
  async function registrarResultado(resultado: string) {
    if (!prospecto || registrandoResultado) return;
    setRegistrandoResultado(true);

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toISOString().split('T')[0];
    const en3Dias = new Date();
    en3Dias.setDate(en3Dias.getDate() + 3);
    const en3DiasStr = en3Dias.toISOString().split('T')[0];

    // Cada resultado aplica etapa + próxima acción sin más capturas.
    const EFECTOS: Record<string, { estado?: string; accion?: string; fecha?: string }> = {
      'Respondió · interesado':   { estado: 'Contactado', accion: 'Dar seguimiento a la conversación', fecha: mananaStr },
      'Quiere cotización':        { estado: 'Calificado', accion: 'Preparar y enviar cotización', fecha: mananaStr },
      'No respondió':             { accion: 'Reintentar llamada', fecha: mananaStr },
      'Pidió tiempo':             { estado: 'Contactado', accion: 'Retomar contacto', fecha: en3DiasStr },
      'No interesado':            { estado: 'Perdido' },
    };
    const efecto = EFECTOS[resultado] || {};

    const cambios: Record<string, string> = {};
    if (efecto.estado) cambios.estado = efecto.estado;
    if (efecto.accion) { cambios.proxima_accion = efecto.accion; cambios.fecha_proxima = efecto.fecha!; }
    if (Object.keys(cambios).length) {
      await supabase.from('prospectos').update(cambios).eq('id', prospectoId);
    }

    await registrarActividad({
      tipo: 'resultado_contacto',
      descripcion: `${resultado}` +
        (efecto.estado ? ` · etapa → ${efecto.estado}` : '') +
        (efecto.accion ? ` · siguiente: ${efecto.accion} (${efecto.fecha})` : ''),
      prospecto_id: prospectoId,
    });
    await sellarPrimerContacto(prospectoId, 'llamada');

    setRegistrandoResultado(false);
    cargarFicha(prospectoId);
  }

  function abrirWhatsAppFicha() {
    void registrarActividad({
      tipo: 'contacto_whatsapp',
      descripcion: `WhatsApp abierto para ${prospecto?.nombre}`,
      prospecto_id: prospectoId,
    });
    void sellarPrimerContacto(prospectoId, 'whatsapp');
  }

  async function guardarProximaAccion(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('prospectos').update({ proxima_accion: nuevaAccion, fecha_proxima: nuevaFecha }).eq('id', prospectoId);
    if (error) alert('Error al guardar la acción');
    else {
      void registrarActividad({
        tipo: 'proxima_accion_definida',
        descripcion: `${nuevaAccion} · ${nuevaFecha}`,
        prospecto_id: prospectoId,
      });
      setNuevaAccion(''); setNuevaFecha(''); cargarFicha(prospectoId);
    }
  }

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('citas').insert([{
      titulo: prospecto.nombre, fecha: citaFecha, hora: citaHora, tipo: citaTipo, estado: 'Pendiente', prospecto_id: prospectoId, user_id: user.id
    }]);
    if (error) alert('Error al agendar');
    else {
      void registrarActividad({
        tipo: 'cita_creada',
        descripcion: `${citaTipo} · ${citaFecha} ${citaHora}`,
        prospecto_id: prospectoId,
      });
      setMostrarFormCita(false); setCitaFecha(''); setCitaHora(''); setCitaTipo('Llamada'); cargarFicha(prospectoId);
    }
  }

  async function guardarDiagnostico(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('diagnosticos').insert([{
      cliente: prospecto.nombre,
      que_proteger: dProteger,
      riesgo_preocupante: dRiesgo,
      producto_posible: dProductoPosible,
      aseguradoras_consultar: dAseguradoras,
      fecha_decision: dFechaDecision,
      nota: dProximaAccion,
      producto_sugerido: dProductoPosible,
      prospecto_id: prospectoId,
      user_id: user.id
    }]);

    if (error) {
      alert('Error al guardar diagnóstico: ' + error.message);
    } else {
      await supabase.from('prospectos').update({ proxima_accion: dProximaAccion, fecha_proxima: dFechaDecision }).eq('id', prospectoId);
      void registrarActividad({
        tipo: 'diagnostico_creado',
        descripcion: `Proteger: ${dProteger} · Producto: ${dProductoPosible} · Decisión: ${dFechaDecision}`,
        prospecto_id: prospectoId,
      });
      setMostrarFormDiag(false);
      setDProteger(''); setDRiesgo(''); setDProductoPosible(''); setDAseguradoras(''); setDFechaDecision(''); setDProximaAccion('');
      cargarFicha(prospectoId);
    }
  }

  async function guardarOportunidad(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Modelo nuevo: UNA oportunidad; la aseguradora/prima van como
    // cotización anidada.
    const { data: op, error } = await supabase.from('oportunidades').insert([{
      cliente: prospecto.nombre, producto: oppProducto, estado: 'Cotizando', prospecto_id: prospectoId, user_id: user.id
    }]).select().single();
    if (error) { alert('Error al guardar cotización'); return; }

    const { error: errCot } = await supabase.from('cotizaciones').insert([{
      oportunidad_id: op.id,
      aseguradora: oppAseguradora,
      prima: oppPrima || null,
      estado: oppPrima ? 'Cotizada' : 'Pendiente',
      user_id: user.id,
    }]);
    if (errCot) alert('Oportunidad creada, pero falló la cotización: ' + errCot.message);

    void registrarActividad({
      tipo: 'oportunidad_creada',
      descripcion: `${oppProducto} · ${oppAseguradora}${oppPrima ? ` · ${oppPrima}` : ''}`,
      prospecto_id: prospectoId,
      oportunidad_id: op.id,
    });
    setMostrarFormOpp(false); setOppPrima(''); cargarFicha(prospectoId);
  }

  async function convertirACliente() {
    if (!prospecto || convirtiendo) return; // guard anti doble-clic
    if (prospecto.cliente_id) {
      alert('Este prospecto ya fue convertido en cliente anteriormente.');
      return;
    }
    setConvirtiendo(true);

    // Conversión TRANSACCIONAL en el servidor (RPC): crea el cliente,
    // migra citas/oportunidades/diagnósticos/trámites/servicios y sella
    // el prospecto en una sola transacción. O todo, o nada.
    const { data: clienteId, error } = await supabase.rpc('convertir_prospecto_a_cliente', {
      p_prospecto_id: prospectoId,
    });

    if (error || !clienteId) {
      // Error original visible en consola para diagnóstico; mensaje claro al usuario.
      console.error('convertir_prospecto_a_cliente:', error);
      const detalle = error?.message || 'error desconocido';
      const pista = detalle.includes('function') || detalle.includes('schema')
        ? '\n\nPista: parece que falta correr la migración en Supabase (reparacion_integral_20260718.sql).'
        : '';
      alert('No se pudo convertir: ' + detalle + pista);
      setConvirtiendo(false); // el botón queda disponible tras el fallo
    } else {
      alert('🎉 ¡Venta Cerrada!\n\nCliente creado e historial migrado. Ahora te llevaré a su Expediente para registrar la póliza.');
      router.push(`/clientes/${clienteId}?nuevaPoliza=true`); // solo navega tras éxito
    }
  }

  if (cargando) return <div className="min-h-screen flex items-center justify-center"><p className="font-hand text-xl text-ink-faint">cargando ficha...</p></div>;

  // ── Briefing automático (reglas explicables, sin costo de IA) ──
  const hoyStr = new Date().toISOString().split('T')[0];
  const ultimaActividad = actividades[0];
  const citaProxima = citas
    .filter(c => c.estado === 'Pendiente' && c.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const objetivoSugerido =
    prospecto?.estado === 'Convertido' ? 'Cuidar la relación postventa'
    : !prospecto?.primer_contacto_at && prospecto?.fuente === 'landing' ? 'Hacer el PRIMER contacto (el lead sigue caliente)'
    : diagnosticos.length === 0 ? 'Agendar el diagnóstico de necesidades'
    : oportunidades.length === 0 ? 'Registrar y presentar la cotización'
    : 'Dar seguimiento a la cotización y cerrar';

  // ¿En qué paso del proceso va ESTA persona? (se calcula de sus datos)
  const contactado = !!prospecto?.primer_contacto_at ||
    ['Contactado', 'Calificado', 'Convertido'].includes(prospecto?.estado);
  const PASOS_PERSONA = [
    { nombre: 'Contactar', hecho: contactado },
    { nombre: 'Diagnosticar', hecho: diagnosticos.length > 0 },
    { nombre: 'Cotizar', hecho: oportunidades.length > 0 },
    { nombre: 'Cerrar', hecho: prospecto?.estado === 'Convertido' },
  ];
  const pasoActual = PASOS_PERSONA.findIndex(p => !p.hecho);

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">
      <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-lg text-ink-soft leading-none mb-1">historial completo</p>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Ficha del Prospecto</h1>
        </div>
        <Link href="/prospectos" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Volver</Link>
      </header>

      <main className="p-6 space-y-8">

        {/* ── Briefing: el contexto en 20 segundos, antes de llamar ── */}
        <div className="lumo-card relative p-4 border-l-4 border-l-azul">
          <p className="text-xs text-azul uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
            <Icon name="hoy" size={14} /> Antes de contactar
          </p>

          {/* ¿Dónde va esta persona en el proceso? */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {PASOS_PERSONA.map((p, i) => (
              <span key={p.nombre} className="flex items-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                  p.hecho ? 'bg-verde-soft text-verde'
                  : i === pasoActual ? 'bg-azul text-white'
                  : 'bg-card text-ink-faint border border-ink/10'
                }`}>
                  {p.hecho ? '✓ ' : `${i + 1} `}{p.nombre}
                </span>
                {i < PASOS_PERSONA.length - 1 && <span className="text-ink-faint text-[10px]">→</span>}
              </span>
            ))}
          </div>
          <div className="text-sm text-ink space-y-1">
            <p><span className="text-ink-faint">Interés:</span> <b>{prospecto?.producto || 'sin definir'}</b> · etapa <b>{prospecto?.estado}</b></p>
            {ultimaActividad && (
              <p><span className="text-ink-faint">Último movimiento:</span> {ETIQUETAS_ACTIVIDAD[ultimaActividad.tipo] || ultimaActividad.tipo} · {tiempoTranscurrido(ultimaActividad.created_at)}</p>
            )}
            {prospecto?.proxima_accion && (
              <p><span className="text-ink-faint">Promesa pendiente:</span> {prospecto.proxima_accion} ({prospecto.fecha_proxima || 'sin fecha'})</p>
            )}
            {citaProxima && (
              <p><span className="text-ink-faint">Próxima cita:</span> {citaProxima.tipo} el {citaProxima.fecha} a las {citaProxima.hora}</p>
            )}
            {prospecto?.nota_entrada_web && (
              <p><span className="text-ink-faint">Pidió en la web:</span> {prospecto.nota_entrada_web.slice(0, 120)}</p>
            )}
          </div>
          <p className="text-sm font-bold text-azul mt-2">Objetivo: {objetivoSugerido}</p>
        </div>

        {/* ── Registro post-llamada de 1 toque ── */}
        <div className="lumo-card p-4">
          <p className="text-xs text-ink-soft uppercase tracking-wider font-bold mb-2">¿Cómo terminó el contacto?</p>
          <div className="flex flex-wrap gap-2">
            {['Respondió · interesado', 'Quiere cotización', 'No respondió', 'Pidió tiempo', 'No interesado'].map(r => (
              <button
                key={r}
                disabled={registrandoResultado}
                onClick={() => registrarResultado(r)}
                className={`text-xs px-3 py-2 rounded-xl border font-semibold transition-colors disabled:opacity-40 ${
                  r === 'No interesado'
                    ? 'bg-rojo-soft text-rojo border-rojo/20 hover:bg-rojo hover:text-white'
                    : 'bg-azul-soft text-azul border-azul/20 hover:bg-azul hover:text-white'
                }`}
              >{r}</button>
            ))}
          </div>
          <p className="font-hand text-sm text-ink-faint mt-2">un toque: registra el resultado, ajusta la etapa y agenda lo que sigue.</p>
        </div>

        <div className="lumo-card relative p-5">
          <span className="lumo-tape"></span>
          <h2 className="text-xl font-bold text-ink">{prospecto?.nombre}</h2>
          <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5">
            <Icon name="phone" size={14} /> {prospecto?.telefono || 'Sin teléfono'}
          </p>
          <p className="text-sm text-azul font-semibold mt-1">Interés: {prospecto?.producto || 'No especificado'}</p>

          {prospecto?.nota && (
            <div className="mt-4 bg-paper p-3 rounded-lg border border-ink/10">
              <p className="text-xs text-ink-faint uppercase mb-1 font-bold tracking-wide">Nota Inicial</p>
              <p className="text-sm text-ink whitespace-pre-wrap">{prospecto.nota}</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {prospecto?.telefono && (
             <a href={`https://wa.me/${prospecto.telefono.replace(/[^0-9]/g, '').length === 10 ? '52' + prospecto.telefono.replace(/[^0-9]/g, '') : prospecto.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={abrirWhatsAppFicha} className="text-center text-sm bg-green-600/20 text-green-400 border border-green-800 font-medium py-2 rounded-lg hover:bg-green-600/40">WhatsApp</a>
            )}
            <button onClick={() => { setMostrarFormCita(!mostrarFormCita); setMostrarFormDiag(false); setMostrarFormOpp(false); }} className="text-center text-sm bg-azul-soft text-azul border border-azul/20 font-semibold py-2 rounded-lg hover:bg-azul hover:text-white transition-colors">Agendar Cita</button>
            <button onClick={() => { setMostrarFormDiag(!mostrarFormDiag); setMostrarFormCita(false); setMostrarFormOpp(false); }} className="text-center text-sm bg-paper text-ink border border-ink/15 font-semibold py-2 rounded-lg hover:bg-ink hover:text-white transition-colors">Diagnóstico</button>
            <button onClick={() => { setMostrarFormOpp(!mostrarFormOpp); setMostrarFormCita(false); setMostrarFormDiag(false); }} className="text-center text-sm bg-rojo-soft text-rojo border border-rojo/20 font-semibold py-2 rounded-lg hover:bg-rojo hover:text-white transition-colors">Cotizar</button>
            <button onClick={generarMensajeIA} disabled={generandoMsg} className="col-span-2 text-center text-sm bg-azul text-white font-semibold py-2 rounded-lg hover:bg-azul-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="edit" size={15} /> {generandoMsg ? 'Redactando...' : 'Mensaje LUMO'}
            </button>
          </div>

          {errorMsg && <p className="text-rojo text-sm font-medium bg-rojo-soft rounded-lg p-2 mt-3">{errorMsg}</p>}

          {mensajeIA && (
            <div className="mt-4 bg-paper lumo-lines p-3 rounded-lg border border-ink/10">
              <p className="text-xs text-ink-faint uppercase mb-2 font-bold tracking-wide">Borrador · revísalo antes de enviar</p>
              <textarea
                value={mensajeIA}
                onChange={(e) => setMensajeIA(e.target.value)}
                rows={5}
                className="w-full bg-transparent text-ink text-sm resize-none focus:outline-none"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => navigator.clipboard.writeText(mensajeIA)} className="lumo-btn-ghost px-3 py-2 text-xs">Copiar</button>
                {prospecto?.telefono && (
                  <a
                    href={`https://wa.me/${prospecto.telefono.replace(/[^0-9]/g, '').length === 10 ? '52' + prospecto.telefono.replace(/[^0-9]/g, '') : prospecto.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(mensajeIA)}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={abrirWhatsAppFicha}
                    className="text-verde text-xs bg-verde-soft px-3 py-2 rounded-xl border border-verde/20 font-semibold"
                  >Enviar por WhatsApp</a>
                )}
              </div>
            </div>
          )}
        </div>

        {mostrarFormCita && (
          <form onSubmit={guardarCita} className="lumo-card p-4 border-azul/40 space-y-3">
            <h3 className="font-bold text-azul text-sm uppercase tracking-wide">Nueva Cita para {prospecto?.nombre}</h3>
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-xs text-ink-soft font-semibold mb-1">Fecha</label>
                <input type="date" value={citaFecha} onChange={(e) => setCitaFecha(e.target.value)} required className="lumo-input p-2 text-sm" />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-ink-soft font-semibold mb-1">Hora</label>
                <input type="time" value={citaHora} onChange={(e) => setCitaHora(e.target.value)} required className="lumo-input p-2 text-sm" />
              </div>
            </div>
            <select value={citaTipo} onChange={(e) => setCitaTipo(e.target.value)} className="lumo-input p-2 text-sm">
              <option>Llamada</option><option>Videollamada</option><option>Visita</option><option>Diagnóstico</option><option>Seguimiento</option>
            </select>
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Confirmar Cita</button>
          </form>
        )}

        {mostrarFormDiag && (
          <form onSubmit={guardarDiagnostico} className="lumo-card p-4 border-ink/30 space-y-3">
            <h3 className="font-bold text-ink text-sm uppercase tracking-wide">Descubrimiento de Necesidades</h3>

            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">1. ¿Qué desea proteger o lograr?</label>
              <input type="text" value={dProteger} onChange={(e) => setDProteger(e.target.value)} required className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">2. ¿Qué riesgo le preocupa?</label>
              <input type="text" value={dRiesgo} onChange={(e) => setDRiesgo(e.target.value)} required className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">3. ¿Qué producto puede tener sentido?</label>
              <input type="text" value={dProductoPosible} onChange={(e) => setDProductoPosible(e.target.value)} required placeholder="Ej: Vida, Gastos Médicos..." className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">4. ¿Qué aseguradoras conviene consultar?</label>
              <input type="text" value={dAseguradoras} onChange={(e) => setDAseguradoras(e.target.value)} required placeholder="Ej: AXA, MetLife" className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">5. ¿Cuándo podría tomar una decisión?</label>
              <input type="date" value={dFechaDecision} onChange={(e) => setDFechaDecision(e.target.value)} required className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">6. ¿Cuál será la siguiente acción?</label>
              <input type="text" value={dProximaAccion} onChange={(e) => setDProximaAccion(e.target.value)} required placeholder="Ej: Enviar cotización el viernes" className="lumo-input p-2 text-sm" />
            </div>
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Guardar y Actualizar Seguimiento</button>
          </form>
        )}

        {mostrarFormOpp && (
          <form onSubmit={guardarOportunidad} className="lumo-card p-4 border-rojo/40 space-y-3">
            <h3 className="font-bold text-rojo text-sm uppercase tracking-wide">Registrar Cotización</h3>
            <div className="flex gap-2">
              <select value={oppProducto} onChange={(e) => setOppProducto(e.target.value)} className="lumo-input w-1/2 p-2 text-sm">
                <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
              </select>
              <select value={oppAseguradora} onChange={(e) => setOppAseguradora(e.target.value)} className="lumo-input w-1/2 p-2 text-sm">
                <option>AXA</option><option>MetLife</option><option>Profuturo</option><option>GNP</option><option>Mapfre</option>
              </select>
            </div>
            <input type="text" placeholder="Prima anual (Ej: $12,000)" value={oppPrima} onChange={(e) => setOppPrima(e.target.value)} className="lumo-input p-2 text-sm" />
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Guardar Cotización</button>
          </form>
        )}

        <div className="lumo-card border-l-4 border-l-rojo p-4">
          <p className="text-xs text-rojo uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
            <Icon name="alert" size={14} /> Próxima Acción
          </p>
          {prospecto?.proxima_accion ? (
            <div>
              <p className="text-ink font-semibold">{prospecto.proxima_accion}</p>
              <p className="text-ink-soft text-sm mt-1 flex items-center gap-1.5">
                <Icon name="calendar" size={14} /> {prospecto.fecha_proxima || 'Sin fecha'}
              </p>
            </div>
          ) : (
            <p className="font-hand text-lg text-ink-faint">no hay próxima acción definida</p>
          )}
          <form onSubmit={guardarProximaAccion} className="mt-4 pt-4 border-t border-ink/10 space-y-2">
            <p className="text-xs text-ink-soft font-semibold">Actualizar manualmente:</p>
            <input type="text" placeholder="Ej: Llamar el viernes..." value={nuevaAccion} onChange={(e) => setNuevaAccion(e.target.value)} required className="lumo-input p-2 text-sm" />
            <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} required className="lumo-input p-2 text-sm" />
            <button type="submit" className="w-full lumo-btn-danger py-2 text-sm">Guardar Acción</button>
          </form>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Descubrimientos Realizados</h3>
          <div className="space-y-2">
            {diagnosticos.map(d => (
              <div key={d.id} className="lumo-card p-3 text-sm">
                <div className="text-ink space-y-1">
                  <p><span className="text-ink-faint">Proteger:</span> {d.que_proteger || 'N/A'}</p>
                  <p><span className="text-ink-faint">Riesgo:</span> {d.riesgo_preocupante || 'N/A'}</p>
                  <p><span className="text-ink-faint">Producto:</span> <span className="text-azul font-semibold">{d.producto_posible || 'N/A'}</span></p>
                  <p><span className="text-ink-faint">Aseguradoras:</span> {d.aseguradoras_consultar || 'N/A'}</p>
                  <p><span className="text-ink-faint">Decisión:</span> {d.fecha_decision || 'N/A'}</p>
                  <p><span className="text-ink-faint">Acción:</span> <span className="text-rojo font-semibold">{d.nota || 'N/A'}</span></p>
                </div>
              </div>
            ))}
            {diagnosticos.length === 0 && <p className="font-hand text-lg text-ink-faint">sin diagnósticos registrados</p>}
          </div>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Cotizaciones Relacionadas</h3>
          <div className="space-y-2">
            {oportunidades.map(o => (
              <div key={o.id} className="lumo-card p-3 text-sm flex justify-between items-center">
                <div>
                  <p className="text-ink font-semibold">{o.producto} <span className="text-ink-faint">({o.aseguradora})</span></p>
                  <p className="text-ink-soft text-xs">Prima: {o.prima || 'N/A'}</p>
                </div>
                <span className="lumo-chip lumo-chip-azul">{o.estado}</span>
              </div>
            ))}
            {oportunidades.length === 0 && <p className="font-hand text-lg text-ink-faint">aún no hay cotizaciones para este prospecto</p>}
          </div>
        </div>

        {/* ── Línea de tiempo universal ── */}
        <div>
          <h3 className="lumo-section-title mb-3">Línea de Tiempo</h3>
          <div className="lumo-card divide-y divide-ink/5">
            {actividades.map(a => (
              <div key={a.id} className="p-3 text-sm flex gap-3 items-start">
                <span className="w-2 h-2 rounded-full bg-azul mt-1.5 shrink-0"></span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-semibold">{ETIQUETAS_ACTIVIDAD[a.tipo] || a.tipo}</p>
                  {a.descripcion && <p className="text-ink-soft text-xs mt-0.5 break-words">{a.descripcion}</p>}
                </div>
                <span className="text-ink-faint text-xs whitespace-nowrap">{tiempoTranscurrido(a.created_at)}</span>
              </div>
            ))}
            {actividades.length === 0 && (
              <p className="font-hand text-lg text-ink-faint p-4">aún no hay actividad registrada (corre la migración operativa)</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Historial de Citas</h3>
          <div className="space-y-2">
            {citas.map(c => (
              <div key={c.id} className="lumo-card p-3 text-sm flex justify-between items-center">
                <div>
                  <p className="text-ink font-semibold">{c.tipo}</p>
                  <p className="text-ink-soft text-xs">{c.fecha} a las {c.hora}</p>
                </div>
                <span className="lumo-chip">{c.estado}</span>
              </div>
            ))}
            {citas.length === 0 && <p className="font-hand text-lg text-ink-faint">sin citas registradas</p>}
          </div>
        </div>

        {prospecto?.estado !== 'Convertido' && (
          <div className="pt-4 border-t border-ink/10">
            <button onClick={convertirACliente} disabled={convirtiendo} className="w-full lumo-btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              <Icon name="rocket" size={18} /> {convirtiendo ? 'Convirtiendo…' : 'Convertir en Cliente (Venta Directa)'}
            </button>
            <p className="text-center font-hand text-base text-ink-faint mt-2">¿el cliente compró sin embudo? úsalo sin culpa.</p>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
