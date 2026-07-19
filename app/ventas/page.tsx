"use client";
// ============================================================
// LUMO · Ventas — Modelo nuevo (auditoría, sección 14):
// UNA oportunidad por persona/producto; las alternativas por
// aseguradora viven anidadas en `cotizaciones`. Así el pipeline
// y las métricas cuentan intenciones reales, no filas por
// aseguradora.
// Vista: pipeline en pestañas A→E; la fila es compacta y al
// tocarla se abre el área de trabajo (cotizaciones y estado).
// ============================================================
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, EncabezadoModulo, ProcessTabs, Buscador, FilaRegistro, ListaFilas, CargarMas, EstadoVacio } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { toast, confirmarLumo } from '../components/Notificaciones';

type Cotizacion = {
  id: string;
  aseguradora: string;
  prima: string | null;
  estado: string;
};

type Oportunidad = {
  id: string;
  cliente: string;
  producto: string;
  aseguradora: string | null; // legado
  prima: string | null;       // legado
  estado: string;
  cotizaciones: Cotizacion[];
};

const ASEGURADORAS = ['AXA', 'MetLife', 'Profuturo', 'GNP', 'HDI', 'ABA Seguros', 'Seguros Monterrey', 'Mapfre', 'Qualitas'];
const ESTADOS_OPORTUNIDAD = ['Por diagnosticar', 'Cotizando', 'Propuesta presentada', 'Negociación', 'Aceptada', 'Trámite en aseguradora', 'Emitida', 'Ganada', 'Perdida'];
const ESTADOS_COTIZACION = ['Pendiente', 'Cotizada', 'Presentada', 'Elegida', 'Descartada'];

const PASO = 20;

const GRUPOS = [
  { id: 'pordiag',     letra: 'A', titulo: 'Por diagn.', estados: ['Por diagnosticar'] },
  { id: 'cotizando',   letra: 'B', titulo: 'Cotizando',  estados: ['Cotizando'] },
  { id: 'seguimiento', letra: 'C', titulo: 'Seguimiento', estados: ['Propuesta presentada', 'Negociación', 'Aceptada', 'Trámite en aseguradora', 'Emitida'] },
  { id: 'ganadas',     letra: 'D', titulo: 'Ganadas',    estados: ['Ganada'] },
  { id: 'perdidas',    letra: 'E', titulo: 'Perdidas',   estados: ['Perdida'] },
] as const;
type GrupoId = typeof GRUPOS[number]['id'];

function grupoDe(o: Oportunidad): GrupoId {
  const g = GRUPOS.find(g => (g.estados as readonly string[]).includes(o.estado));
  return g ? g.id : 'seguimiento';
}

export default function Ventas() {
  const [producto, setProducto] = useState('Vida');
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [personas, setPersonas] = useState<{ id: string; nombre: string; tipo: string }[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{ id: string, tipo: string } | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState<GrupoId>('pordiag');
  const [expandidaId, setExpandidaId] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PASO);

  // Cotización nueva (por oportunidad)
  const [agregandoCotEn, setAgregandoCotEn] = useState<string | null>(null);
  const [cotAseguradora, setCotAseguradora] = useState('AXA');
  const [cotPrima, setCotPrima] = useState('');

  // Edición de prima de una cotización
  const [editCotId, setEditCotId] = useState<string | null>(null);
  const [editCotPrima, setEditCotPrima] = useState('');

  useEffect(() => {
    cargarOportunidades(true);
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LumoCapture avisa cuando crea datos: refrescar sin recargar.
  useEffect(() => {
    const refrescar = () => cargarOportunidades();
    window.addEventListener('lumo:datos-actualizados', refrescar);
    return () => window.removeEventListener('lumo:datos-actualizados', refrescar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarOportunidades(inicial = false) {
    const { data } = await supabase
      .from('oportunidades')
      .select('*, cotizaciones(*)')
      .order('created_at', { ascending: false });
    if (data) {
      const lista = (data as Oportunidad[]).map(o => ({
        ...o,
        cotizaciones: (o.cotizaciones || []).sort((a, b) => a.aseguradora.localeCompare(b.aseguradora)),
      }));
      setOportunidades(lista);
      if (inicial && !lista.some(o => grupoDe(o) === 'pordiag')) {
        setGrupoActivo(lista.some(o => grupoDe(o) === 'cotizando') ? 'cotizando' : 'seguimiento');
      }
    }
  }

  async function cargarPersonas() {
    const { data: pros } = await supabase.from('prospectos').select('id, nombre, estado').neq('estado', 'Convertido').neq('estado', 'Perdido');
    const { data: cli } = await supabase.from('clientes').select('id, nombre');
    const listaProspectos = (pros || []).map(p => ({ id: p.id, nombre: p.nombre, tipo: 'prospecto' }));
    const listaClientes = (cli || []).map(c => ({ id: c.id, nombre: c.nombre, tipo: 'cliente' }));
    setPersonas([...listaProspectos, ...listaClientes]);
  }

  async function guardarOportunidad(e: React.FormEvent) {
    e.preventDefault();
    if (!personaSeleccionada) {
      toast('Por favor selecciona un prospecto o cliente de la lista.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const personaObj = personas.find(p => p.id === personaSeleccionada.id);
    const nombreCliente = personaObj?.nombre || 'Desconocido';

    const { data: op, error } = await supabase.from('oportunidades').insert([{
      cliente: nombreCliente,
      producto,
      estado: 'Por diagnosticar',
      prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
      cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      user_id: user.id
    }]).select().single();

    if (error) {
      toast('Error al guardar: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'oportunidad_creada',
        descripcion: `${nombreCliente} · ${producto}`,
        prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
        cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
        oportunidad_id: op?.id,
      });
      setPersonaSeleccionada(null);
      setMostrarForm(false);
      setGrupoActivo('pordiag');
      cargarOportunidades();
    }
  }

  async function eliminarOportunidad(id: string) {
    if (!(await confirmarLumo({ titulo: 'Eliminar oportunidad', mensaje: 'Se eliminará esta oportunidad y todas sus cotizaciones.', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('oportunidades').delete().eq('id', id);
    if (error) toast('Error al eliminar: ' + error.message);
    else { setExpandidaId(null); cargarOportunidades(); }
  }

  async function cambiarEstadoOportunidad(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('oportunidades').update({ estado: nuevoEstado }).eq('id', id);
    if (error) toast('Error al actualizar');
    else cargarOportunidades();
  }

  // ── Cotizaciones ──

  async function agregarCotizacion(e: React.FormEvent, oportunidadId: string) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('cotizaciones').insert([{
      oportunidad_id: oportunidadId,
      aseguradora: cotAseguradora,
      prima: cotPrima || null,
      estado: cotPrima ? 'Cotizada' : 'Pendiente',
      user_id: user.id,
    }]);

    if (error) {
      toast('Error al agregar cotización: ' + error.message);
    } else {
      const op = oportunidades.find(o => o.id === oportunidadId);
      void registrarActividad({
        tipo: 'cotizacion_agregada',
        descripcion: `${cotAseguradora}${cotPrima ? ` · ${cotPrima}` : ' · pendiente'}`,
        prospecto_id: (op as unknown as { prospecto_id?: string })?.prospecto_id || null,
        cliente_id: (op as unknown as { cliente_id?: string })?.cliente_id || null,
        oportunidad_id: oportunidadId,
      });
      setAgregandoCotEn(null);
      setCotPrima('');
      cargarOportunidades();
    }
  }

  async function cambiarEstadoCotizacion(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('cotizaciones').update({ estado: nuevoEstado }).eq('id', id);
    if (error) toast('Error al actualizar');
    else cargarOportunidades();
  }

  async function guardarPrimaCotizacion(e: React.FormEvent, cot: Cotizacion) {
    e.preventDefault();
    // Si estaba Pendiente y ahora tiene prima, pasa sola a Cotizada.
    const cambios: { prima: string | null; estado?: string } = { prima: editCotPrima || null };
    if (editCotPrima && cot.estado === 'Pendiente') cambios.estado = 'Cotizada';

    const { error } = await supabase.from('cotizaciones').update(cambios).eq('id', cot.id);
    if (error) toast('Error al guardar la prima');
    setEditCotId(null);
    cargarOportunidades();
  }

  async function eliminarCotizacion(id: string) {
    if (!(await confirmarLumo({ mensaje: '¿Eliminar esta cotización?', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
    if (error) toast('Error al eliminar');
    else cargarOportunidades();
  }

  const q = busqueda.trim().toLowerCase();
  const buscadas = oportunidades.filter(o =>
    o.cliente?.toLowerCase().includes(q)
  );
  const lista = q ? buscadas : buscadas.filter(o => grupoDe(o) === grupoActivo);

  const chipEstadoCot = (estado: string) =>
    estado === 'Elegida' ? 'lumo-chip-azul'
    : estado === 'Descartada' ? 'lumo-chip-negro'
    : '';

  function lineaAccion(o: Oportunidad): { texto: string; tono: 'rojo' | 'azul' | 'neutro' } {
    const g = grupoDe(o);
    if (g === 'pordiag') return { texto: 'Hacer diagnóstico', tono: 'rojo' };
    if (g === 'cotizando') {
      const sinPrima = o.cotizaciones.filter(c => !c.prima).length;
      return { texto: sinPrima > 0 ? `Capturar ${sinPrima} prima${sinPrima === 1 ? '' : 's'}` : 'Presentar propuesta', tono: 'azul' };
    }
    if (g === 'seguimiento') return { texto: o.estado, tono: 'azul' };
    if (g === 'ganadas') return { texto: 'Ganada', tono: 'azul' };
    return { texto: 'Perdida', tono: 'neutro' };
  }

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">

      <EncabezadoModulo
        titulo="Ventas"
        accion={
          <div className="flex items-center gap-2">
            <Link href="/diagnosticos" className="text-xs text-azul border border-azul/25 bg-azul-soft px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5">
              <Icon name="note" size={14} /> Diagnósticos
            </Link>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${mostrarForm ? 'bg-elevada text-ink border border-ink/15' : 'lumo-btn-primary'}`}
            >
              <Icon name="plus" size={15} /> {mostrarForm ? 'Cerrar' : 'Nueva'}
            </button>
          </div>
        }
      >
        <ProcessTabs
          tabs={GRUPOS.map(g => ({ id: g.id, letra: g.letra, titulo: g.titulo, n: buscadas.filter(o => grupoDe(o) === g.id).length }))}
          activa={grupoActivo}
          onCambiar={(id) => { setGrupoActivo(id); setVisibles(PASO); setExpandidaId(null); }}
          alerta="pordiag"
        />
        <Buscador
          valor={busqueda}
          onCambiar={(v) => { setBusqueda(v); setVisibles(PASO); }}
          placeholder="Buscar por cliente…"
        />
      </EncabezadoModulo>

      <main className="p-4 space-y-4">

        {/* Nueva oportunidad: cerrada por defecto */}
        {mostrarForm && (
        <form onSubmit={guardarOportunidad} className="lumo-card p-5 space-y-4">
          <h2 className="font-semibold text-ink text-lg flex items-center gap-2">
            <Icon name="ventas" size={18} className="text-azul" /> Nueva Oportunidad
          </h2>
          <p className="text-sm text-ink-soft -mt-2">
            Una oportunidad por persona; las aseguradoras se cotizan adentro.
          </p>
          <div className="space-y-3">

            <label className="block text-xs text-ink-soft font-semibold">Seleccionar Persona:</label>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") setPersonaSeleccionada(null);
                else {
                  const [id, tipo] = val.split('|');
                  setPersonaSeleccionada({ id, tipo });
                }
              }}
              value={personaSeleccionada ? `${personaSeleccionada.id}|${personaSeleccionada.tipo}` : ""}
              className="lumo-input"
            >
              <option value="">-- Elige un Prospecto o Cliente --</option>
              {personas.map(p => (
                <option key={`${p.id}-${p.tipo}`} value={`${p.id}|${p.tipo}`}>
                  {p.nombre} ({p.tipo})
                </option>
              ))}
            </select>

            <select value={producto} onChange={(e) => setProducto(e.target.value)} className="lumo-input">
              <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option><option>Empresas</option>
            </select>
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">Crear Oportunidad</button>
        </form>
        )}

        {!q && lista.length > 0 && (
          <p className="text-sm text-ink-soft px-1">
            {grupoActivo === 'pordiag' && 'Recién creadas: primero entiende la necesidad.'}
            {grupoActivo === 'cotizando' && 'Consigue las primas y elige la mejor propuesta.'}
            {grupoActivo === 'seguimiento' && 'Esperando respuesta o trámite: empuja el cierre.'}
            {grupoActivo === 'ganadas' && 'Convertidas. De aquí salen pólizas y referidos.'}
            {grupoActivo === 'perdidas' && 'No concretadas. Sirven para aprender, no para cargarlas.'}
          </p>
        )}

        {lista.length > 0 ? (
          <>
            <ListaFilas>
              {lista.slice(0, visibles).map((o) => {
                const a = lineaAccion(o);
                const abierta = expandidaId === o.id;
                return (
                  <div key={o.id}>
                    <FilaRegistro
                      nombre={o.cliente}
                      secundario={`${o.producto || 'Sin producto'} · ${o.cotizaciones.length} cotización${o.cotizaciones.length === 1 ? '' : 'es'}`}
                      accion={a.texto}
                      accionTono={a.tono}
                      onAbrir={() => { setExpandidaId(abierta ? null : o.id); setAgregandoCotEn(null); setEditCotId(null); }}
                    />
                    {abierta && (
                      <div className="px-4 pb-4 bg-card space-y-2">

                        {/* Datos legado (modelo viejo: aseguradora/prima en la fila) */}
                        {(o.aseguradora || o.prima) && o.cotizaciones.length === 0 && (
                          <p className="text-sm text-ink-soft">
                            Registro anterior: <span className="font-semibold text-ink">{o.aseguradora || 'aseguradora s/d'}</span> · {o.prima || 'sin prima'}
                          </p>
                        )}

                        {/* Cotizaciones por aseguradora */}
                        {o.cotizaciones.map(c => (
                          <div key={c.id} className="flex flex-wrap items-center gap-2 bg-elevada rounded-lg px-2.5 py-2 min-w-0">
                            <span className={`lumo-chip ${chipEstadoCot(c.estado)}`}>{c.aseguradora}</span>
                            {editCotId === c.id ? (
                              <form onSubmit={(e) => guardarPrimaCotizacion(e, c)} className="flex-1 flex gap-1">
                                <input
                                  type="text" value={editCotPrima} autoFocus
                                  onChange={(e) => setEditCotPrima(e.target.value)}
                                  placeholder="Prima (Ej: $12,000)"
                                  className="lumo-input py-1 px-2 text-sm"
                                />
                                <button type="submit" className="lumo-btn-primary px-2 py-1 text-xs">OK</button>
                              </form>
                            ) : (
                              <button
                                onClick={() => { setEditCotId(c.id); setEditCotPrima(c.prima || ''); }}
                                className="flex-1 text-left text-sm font-semibold text-azul"
                                title="Editar prima"
                              >
                                {c.prima || 'capturar prima…'}
                              </button>
                            )}
                            <select
                              value={c.estado}
                              onChange={(e) => cambiarEstadoCotizacion(c.id, e.target.value)}
                              className="text-xs border border-ink/15 rounded-md p-1 bg-elevada text-ink-soft"
                            >
                              {ESTADOS_COTIZACION.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => eliminarCotizacion(c.id)} className="text-ink-faint hover:text-rojo"><Icon name="trash" size={14} /></button>
                          </div>
                        ))}

                        {agregandoCotEn === o.id ? (
                          <form onSubmit={(e) => agregarCotizacion(e, o.id)} className="flex flex-wrap gap-2 items-center">
                            <select value={cotAseguradora} onChange={(e) => setCotAseguradora(e.target.value)} className="lumo-input py-2 text-sm w-2/5">
                              {ASEGURADORAS.map(a2 => <option key={a2}>{a2}</option>)}
                            </select>
                            <input
                              type="text" value={cotPrima} onChange={(e) => setCotPrima(e.target.value)}
                              placeholder="Prima (opcional)" className="lumo-input py-2 text-sm flex-1"
                            />
                            <button type="submit" className="lumo-btn-primary px-3 py-2 text-xs">Añadir</button>
                            <button type="button" onClick={() => setAgregandoCotEn(null)} className="text-ink-faint text-xs px-1">✕</button>
                          </form>
                        ) : (
                          <button
                            onClick={() => { setAgregandoCotEn(o.id); setCotPrima(''); }}
                            className="lumo-btn-ghost w-full py-2 text-xs flex items-center justify-center gap-1.5"
                          >
                            <Icon name="plus" size={13} /> Cotizar en aseguradora
                          </button>
                        )}

                        <div className="pt-2 border-t border-ink/10 flex items-center gap-2">
                          <select value={o.estado} onChange={(e) => cambiarEstadoOportunidad(o.id, e.target.value)} className="text-sm border border-ink/15 rounded-lg p-2 bg-elevada text-ink font-medium flex-1 focus:outline-none focus:border-azul">
                            {ESTADOS_OPORTUNIDAD.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => eliminarOportunidad(o.id)} className="text-ink-faint hover:text-rojo p-2" title="Eliminar"><Icon name="trash" size={16} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </ListaFilas>
            <CargarMas visibles={visibles} total={lista.length} onMas={() => setVisibles(v => v + PASO)} paso={PASO} />
          </>
        ) : (
          <EstadoVacio texto={q ? 'sin resultados con esa búsqueda' : 'nada pendiente en esta etapa'} />
        )}
      </main>

      <BottomNav />
    </div>
  );
}
