"use client";
// ============================================================
// LUMO · Bandeja universal de captura
// Botón flotante "+ Añadir a LUMO" disponible en toda la app.
// Flujo: escribir/pegar/dictar → LUMO propone acciones →
// el asesor revisa y confirma → se ejecutan → quedan registradas.
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { Icon } from './lumo';

type Persona = { id: string; nombre: string; tipo: 'prospecto' | 'cliente'; telefono?: string };

type Accion = {
  tipo: string;
  explicacion: string;
  persona_id: string | null;
  persona_nombre: string;
  datos: Record<string, string | undefined>;
};

type AccionRevisada = Accion & { incluida: boolean; resultado?: string; error?: boolean };

const ETIQUETAS: Record<string, string> = {
  crear_prospecto: 'Crear prospecto',
  crear_cliente: 'Crear cliente',
  crear_cita: 'Agendar cita',
  definir_proxima_accion: 'Próxima acción',
  crear_oportunidad: 'Registrar cotización',
  crear_servicio: 'Abrir servicio',
  cambiar_estado: 'Cambiar etapa',
  registrar_nota: 'Guardar nota',
  generar_mensaje: 'Mensaje sugerido',
};

function resumenDatos(a: Accion): string {
  const d = a.datos || {};
  switch (a.tipo) {
    case 'crear_prospecto':
      return [d.telefono, d.producto, d.nota].filter(Boolean).join(' · ');
    case 'crear_cliente':
      return d.telefono || '';
    case 'crear_cita':
      return `${d.fecha || ''} ${d.hora || ''} · ${d.tipo || ''}`;
    case 'definir_proxima_accion':
      return `${d.accion || ''} · ${d.fecha || ''}`;
    case 'crear_oportunidad':
      return [d.producto, d.aseguradora, d.prima].filter(Boolean).join(' · ');
    case 'crear_servicio':
      return `${d.tipo || ''}: ${d.descripcion || ''}`;
    case 'cambiar_estado':
      return `→ ${d.nuevo_estado || ''}`;
    case 'registrar_nota':
      return d.nota || '';
    case 'generar_mensaje':
      return d.mensaje || '';
    default:
      return '';
  }
}

export default function LumoCapture() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [fase, setFase] = useState<'captura' | 'pensando' | 'revision' | 'hecho'>('captura');
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState('');
  const [acciones, setAcciones] = useState<AccionRevisada[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grabando, setGrabando] = useState(false);
  const [mensajesGenerados, setMensajesGenerados] = useState<{ nombre: string; mensaje: string; telefono?: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (recRef.current) recRef.current.stop(); };
  }, []);

  if (pathname === '/login') return null;

  async function cargarPersonas(): Promise<Persona[]> {
    const { data: pros } = await supabase.from('prospectos').select('id, nombre, telefono, estado').neq('estado', 'Convertido').neq('estado', 'Perdido');
    const { data: cli } = await supabase.from('clientes').select('id, nombre, telefono');
    const lista: Persona[] = [
      ...(pros || []).map(p => ({ id: p.id, nombre: p.nombre, tipo: 'prospecto' as const, telefono: p.telefono })),
      ...(cli || []).map(c => ({ id: c.id, nombre: c.nombre, tipo: 'cliente' as const, telefono: c.telefono })),
    ];
    setPersonas(lista);
    return lista;
  }

  function abrir() {
    setAbierto(true);
    setFase('captura');
    setTexto('');
    setError('');
    setAcciones([]);
    setMensajesGenerados([]);
    cargarPersonas();
  }

  function toggleDictado() {
    if (grabando) {
      recRef.current?.stop();
      setGrabando(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setError('Tu navegador no soporta dictado por voz. Escribe o pega el texto.');
      return;
    }
    const rec = new SR();
    rec.lang = 'es-MX';
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) setTexto(t => (t ? t + ' ' : '') + final.trim());
    };
    rec.onend = () => setGrabando(false);
    rec.onerror = () => { setGrabando(false); setError('No pude escuchar. Intenta de nuevo o escribe.'); };
    recRef.current = rec;
    rec.start();
    setGrabando(true);
    setError('');
  }

  async function interpretar() {
    if (!texto.trim()) return;
    if (grabando) { recRef.current?.stop(); setGrabando(false); }
    setFase('pensando');
    setError('');
    try {
      // Privacidad por diseño: al modelo solo van id, nombre y tipo. Nunca teléfonos.
      const personasSinTelefono = personas.map(({ id, nombre, tipo }) => ({ id, nombre, tipo }));
      const res = await fetch('/api/lumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, personas: personasSinTelefono }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al interpretar.');
      if (!data.acciones || data.acciones.length === 0) {
        setError(data.resumen || 'No encontré acciones de CRM en ese texto.');
        setFase('captura');
        return;
      }
      setResumen(data.resumen || '');
      setAcciones((data.acciones as Accion[]).map(a => ({ ...a, incluida: true })));
      setFase('revision');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión.');
      setFase('captura');
    }
  }

  async function confirmar() {
    setFase('pensando');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Tu sesión ha expirado.'); setFase('revision'); return; }

    const seleccionadas = acciones.filter(a => a.incluida);
    const registroCreados = new Map<string, { id: string; tipo: 'prospecto' | 'cliente' }>();
    const resultados: AccionRevisada[] = [];
    const mensajes: { nombre: string; mensaje: string; telefono?: string }[] = [];

    const resolverPersona = (a: Accion): { id: string; tipo: 'prospecto' | 'cliente'; telefono?: string } | null => {
      if (a.persona_id) {
        const p = personas.find(x => x.id === a.persona_id);
        if (p) return p;
      }
      const clave = (a.persona_nombre || '').trim().toLowerCase();
      if (registroCreados.has(clave)) return registroCreados.get(clave)!;
      const p = personas.find(x => x.nombre?.trim().toLowerCase() === clave);
      return p || null;
    };

    for (const a of seleccionadas) {
      const d = a.datos || {};
      try {
        if (a.tipo === 'crear_prospecto') {
          const { data, error } = await supabase.from('prospectos')
            .insert([{ nombre: a.persona_nombre, telefono: d.telefono || '', producto: d.producto || '', nota: d.nota || '', estado: 'Nuevo', user_id: user.id }])
            .select().single();
          if (error) throw error;
          registroCreados.set(a.persona_nombre.trim().toLowerCase(), { id: data.id, tipo: 'prospecto' });
          resultados.push({ ...a, resultado: 'Prospecto creado' });

        } else if (a.tipo === 'crear_cliente') {
          const { data, error } = await supabase.from('clientes')
            .insert([{ nombre: a.persona_nombre, telefono: d.telefono || '', estado: 'Activo', user_id: user.id }])
            .select().single();
          if (error) throw error;
          registroCreados.set(a.persona_nombre.trim().toLowerCase(), { id: data.id, tipo: 'cliente' });
          resultados.push({ ...a, resultado: 'Cliente creado' });

        } else if (a.tipo === 'crear_cita') {
          const persona = resolverPersona(a);
          const { error } = await supabase.from('citas').insert([{
            titulo: a.persona_nombre,
            fecha: d.fecha, hora: d.hora || '09:00', tipo: d.tipo || 'Llamada', estado: 'Pendiente',
            prospecto_id: persona?.tipo === 'prospecto' ? persona.id : null,
            cliente_id: persona?.tipo === 'cliente' ? persona.id : null,
            user_id: user.id,
          }]);
          if (error) throw error;
          resultados.push({ ...a, resultado: 'Cita agendada' });

        } else if (a.tipo === 'definir_proxima_accion') {
          const persona = resolverPersona(a);
          if (persona?.tipo === 'prospecto') {
            const { error } = await supabase.from('prospectos')
              .update({ proxima_accion: d.accion || 'Dar seguimiento', fecha_proxima: d.fecha })
              .eq('id', persona.id);
            if (error) throw error;
            resultados.push({ ...a, resultado: 'Seguimiento programado' });
          } else if (persona?.tipo === 'cliente') {
            const { error } = await supabase.from('citas').insert([{
              titulo: a.persona_nombre, fecha: d.fecha, hora: '09:00', tipo: 'Seguimiento', estado: 'Pendiente',
              cliente_id: persona.id, user_id: user.id,
            }]);
            if (error) throw error;
            resultados.push({ ...a, resultado: 'Seguimiento agendado como cita' });
          } else {
            throw new Error('No encontré a la persona');
          }

        } else if (a.tipo === 'crear_oportunidad') {
          const persona = resolverPersona(a);
          const { error } = await supabase.from('oportunidades').insert([{
            cliente: a.persona_nombre, producto: d.producto || '', aseguradora: d.aseguradora || '', prima: d.prima || '',
            estado: 'Cotizando',
            prospecto_id: persona?.tipo === 'prospecto' ? persona.id : null,
            cliente_id: persona?.tipo === 'cliente' ? persona.id : null,
            user_id: user.id,
          }]);
          if (error) throw error;
          resultados.push({ ...a, resultado: 'Cotización registrada' });

        } else if (a.tipo === 'crear_servicio') {
          const persona = resolverPersona(a);
          const { error } = await supabase.from('servicios').insert([{
            cliente: a.persona_nombre, tipo: d.tipo || 'Otro', descripcion: d.descripcion || '', estado: 'Reportado',
            prospecto_id: persona?.tipo === 'prospecto' ? persona.id : null,
            cliente_id: persona?.tipo === 'cliente' ? persona.id : null,
            user_id: user.id,
          }]);
          if (error) throw error;
          resultados.push({ ...a, resultado: 'Servicio abierto' });

        } else if (a.tipo === 'cambiar_estado') {
          const persona = resolverPersona(a);
          if (persona?.tipo !== 'prospecto') throw new Error('Solo aplica a prospectos');
          const { error } = await supabase.from('prospectos').update({ estado: d.nuevo_estado }).eq('id', persona.id);
          if (error) throw error;
          resultados.push({ ...a, resultado: `Etapa: ${d.nuevo_estado}` });

        } else if (a.tipo === 'registrar_nota') {
          const persona = resolverPersona(a);
          if (persona?.tipo !== 'prospecto') throw new Error('Solo disponible para prospectos');
          const { data: actual } = await supabase.from('prospectos').select('nota').eq('id', persona.id).single();
          const notaNueva = actual?.nota ? `${actual.nota}\n— ${d.nota}` : d.nota;
          const { error } = await supabase.from('prospectos').update({ nota: notaNueva }).eq('id', persona.id);
          if (error) throw error;
          resultados.push({ ...a, resultado: 'Nota guardada' });

        } else if (a.tipo === 'generar_mensaje') {
          const persona = resolverPersona(a);
          mensajes.push({ nombre: a.persona_nombre, mensaje: d.mensaje || '', telefono: persona?.telefono });
          resultados.push({ ...a, resultado: 'Mensaje listo abajo' });
        }
      } catch (e) {
        resultados.push({ ...a, resultado: e instanceof Error ? e.message : 'Error', error: true });
      }
    }

    // Historial de acciones de IA (punto 15) — best effort, no bloquea el flujo
    try {
      await supabase.from('acciones_ia').insert([{
        user_id: user.id,
        texto_original: texto,
        propuesta: acciones.map(({ incluida: _i, resultado: _r, error: _e, ...resto }) => resto),
        confirmadas: resultados.map(({ error: _e, ...resto }) => resto),
        resultado: resultados.some(r => r.error) ? 'parcial' : 'ejecutado',
      }]);
    } catch { /* tabla aún no creada: ignorar */ }

    setAcciones(resultados);
    setMensajesGenerados(mensajes);
    setFase('hecho');
  }

  const numIncluidas = acciones.filter(a => a.incluida).length;

  return (
    <>
      {/* Botón flotante */}
      {!abierto && (
        <button
          onClick={abrir}
          aria-label="Añadir a LUMO"
          className="fixed bottom-24 right-1/2 translate-x-[190px] max-[440px]:right-4 max-[440px]:translate-x-0 z-30 bg-azul text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-azul-dark transition-colors"
        >
          <Icon name="plus" size={26} strokeWidth={2.4} />
        </button>
      )}

      {/* Hoja de captura */}
      {abierto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 backdrop-blur-sm" onClick={() => setAbierto(false)}>
          <div
            className="w-full max-w-md bg-paper rounded-t-3xl border-t border-x border-ink/10 max-h-[85vh] overflow-y-auto p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                <span className="w-8 h-8 bg-azul rounded-lg flex items-center justify-center text-white"><Icon name="hoy" size={18} /></span>
                Añadir a LUMO
              </h2>
              <button onClick={() => setAbierto(false)} className="text-ink-faint hover:text-ink text-sm font-medium px-2 py-1">Cerrar</button>
            </div>

            {fase === 'captura' && (
              <div className="space-y-3">
                <p className="font-hand text-lg text-ink-soft leading-snug">
                  cuéntame qué pasó: una llamada, alguien que conociste, un pendiente... yo lo convierto en acciones.
                </p>
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder='Ej: "Conocí a Laura en el evento de ayer. Tiene una empresa con 30 empleados y le interesan prestaciones. Quedé de escribirle el lunes."'
                  className="lumo-input resize-none"
                />
                {error && <p className="text-rojo text-sm font-medium bg-rojo-soft rounded-lg p-2">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={toggleDictado}
                    className={`lumo-btn-ghost px-4 py-3 flex items-center gap-2 text-sm ${grabando ? 'border-rojo text-rojo animate-pulse' : ''}`}
                  >
                    <Icon name="bell" size={16} /> {grabando ? 'Detener' : 'Dictar'}
                  </button>
                  <button
                    onClick={interpretar}
                    disabled={!texto.trim()}
                    className="flex-1 lumo-btn-primary py-3 disabled:opacity-40"
                  >
                    Interpretar
                  </button>
                </div>
              </div>
            )}

            {fase === 'pensando' && (
              <div className="py-10 text-center">
                <div className="animate-pulse font-hand text-2xl text-ink-soft">lumo está pensando...</div>
              </div>
            )}

            {fase === 'revision' && (
              <div className="space-y-3">
                <p className="text-ink font-semibold">
                  Entendí que quieres realizar {acciones.length} {acciones.length === 1 ? 'acción' : 'acciones'}:
                </p>
                {resumen && <p className="font-hand text-lg text-ink-soft -mt-1">{resumen}</p>}

                {acciones.map((a, i) => (
                  <label key={i} className={`lumo-card p-3 flex gap-3 items-start cursor-pointer transition-opacity ${a.incluida ? '' : 'opacity-40'}`}>
                    <input
                      type="checkbox"
                      checked={a.incluida}
                      onChange={() => setAcciones(acc => acc.map((x, j) => j === i ? { ...x, incluida: !x.incluida } : x))}
                      className="mt-1 accent-[#1F3FD8] w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="lumo-chip lumo-chip-azul">{ETIQUETAS[a.tipo] || a.tipo}</span>
                        <span className="font-bold text-ink text-sm">{a.persona_nombre}</span>
                        {!a.persona_id && ['crear_prospecto', 'crear_cliente'].includes(a.tipo) === false && !personas.some(p => p.nombre?.trim().toLowerCase() === a.persona_nombre?.trim().toLowerCase()) && (
                          <span className="lumo-chip">nuevo</span>
                        )}
                      </div>
                      <p className="text-sm text-ink-soft mt-1 break-words">{resumenDatos(a)}</p>
                      <p className="font-hand text-base text-ink-faint mt-0.5">{a.explicacion}</p>
                    </div>
                  </label>
                ))}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setFase('captura')} className="lumo-btn-ghost px-4 py-3 text-sm">Editar texto</button>
                  <button
                    onClick={confirmar}
                    disabled={numIncluidas === 0}
                    className="flex-1 lumo-btn-primary py-3 disabled:opacity-40"
                  >
                    Confirmar {numIncluidas} {numIncluidas === 1 ? 'acción' : 'acciones'}
                  </button>
                </div>
              </div>
            )}

            {fase === 'hecho' && (
              <div className="space-y-3">
                <p className="text-ink font-bold text-lg flex items-center gap-2">
                  <Icon name="check" size={22} className="text-verde" /> Listo
                </p>
                {acciones.map((a, i) => (
                  <div key={i} className={`lumo-card p-3 text-sm flex justify-between items-center gap-2 ${a.error ? 'border-rojo/40' : ''}`}>
                    <span className="text-ink-soft">{ETIQUETAS[a.tipo]} · <b className="text-ink">{a.persona_nombre}</b></span>
                    <span className={a.error ? 'text-rojo font-semibold' : 'text-verde font-semibold'}>{a.resultado}</span>
                  </div>
                ))}

                {mensajesGenerados.map((m, i) => (
                  <div key={i} className="lumo-card lumo-lines p-4 relative">
                    <span className="lumo-tape"></span>
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-faint mb-1">Mensaje para {m.nombre}</p>
                    <p className="text-ink text-sm whitespace-pre-wrap">{m.mensaje}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(m.mensaje)}
                        className="lumo-btn-ghost px-3 py-2 text-xs"
                      >Copiar</button>
                      {m.telefono && (
                        <a
                          href={`https://wa.me/${m.telefono.replace(/[^0-9]/g, '').length === 10 ? '52' + m.telefono.replace(/[^0-9]/g, '') : m.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(m.mensaje)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-verde text-xs bg-verde-soft px-3 py-2 rounded-xl border border-verde/20 font-semibold"
                        >Enviar por WhatsApp</a>
                      )}
                    </div>
                  </div>
                ))}

                <button onClick={() => { setAbierto(false); window.location.reload(); }} className="w-full lumo-btn-primary py-3">
                  Terminar
                </button>
                <p className="font-hand text-base text-ink-faint text-center">todo quedó registrado en tu historial</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
