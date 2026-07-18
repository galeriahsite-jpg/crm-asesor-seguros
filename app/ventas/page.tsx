"use client";
// ============================================================
// LUMO · Ventas — Modelo nuevo (auditoría, sección 14):
// UNA oportunidad por persona/producto; las alternativas por
// aseguradora viven anidadas en `cotizaciones`. Así el pipeline
// y las métricas cuentan intenciones reales, no filas por
// aseguradora.
// Las oportunidades viejas (con aseguradora/prima en la propia
// fila) se muestran como "legado" y siguen siendo editables.
// ============================================================
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, FlujoProceso } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';

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

export default function Ventas() {
  const [producto, setProducto] = useState('Vida');
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [personas, setPersonas] = useState<{ id: string; nombre: string; tipo: string }[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{ id: string, tipo: string } | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  // Cotización nueva (por oportunidad)
  const [agregandoCotEn, setAgregandoCotEn] = useState<string | null>(null);
  const [cotAseguradora, setCotAseguradora] = useState('AXA');
  const [cotPrima, setCotPrima] = useState('');

  // Edición de prima de una cotización
  const [editCotId, setEditCotId] = useState<string | null>(null);
  const [editCotPrima, setEditCotPrima] = useState('');

  useEffect(() => {
    cargarOportunidades();
    cargarPersonas();
  }, []);

  async function cargarOportunidades() {
    const { data } = await supabase
      .from('oportunidades')
      .select('*, cotizaciones(*)')
      .order('created_at', { ascending: false });
    if (data) {
      setOportunidades((data as Oportunidad[]).map(o => ({
        ...o,
        cotizaciones: (o.cotizaciones || []).sort((a, b) => a.aseguradora.localeCompare(b.aseguradora)),
      })));
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
      alert('Por favor selecciona un prospecto o cliente de la lista.');
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
      alert('Error al guardar: ' + error.message);
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
      cargarOportunidades();
    }
  }

  async function eliminarOportunidad(id: string) {
    if (!confirm('¿Eliminar esta oportunidad y sus cotizaciones?')) return;
    const { error } = await supabase.from('oportunidades').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    else cargarOportunidades();
  }

  async function cambiarEstadoOportunidad(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('oportunidades').update({ estado: nuevoEstado }).eq('id', id);
    if (error) alert('Error al actualizar');
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
      alert('Error al agregar cotización: ' + error.message);
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
    if (error) alert('Error al actualizar');
    else cargarOportunidades();
  }

  async function guardarPrimaCotizacion(e: React.FormEvent, cot: Cotizacion) {
    e.preventDefault();
    // Si estaba Pendiente y ahora tiene prima, pasa sola a Cotizada.
    const cambios: { prima: string | null; estado?: string } = { prima: editCotPrima || null };
    if (editCotPrima && cot.estado === 'Pendiente') cambios.estado = 'Cotizada';

    const { error } = await supabase.from('cotizaciones').update(cambios).eq('id', cot.id);
    if (error) alert('Error al guardar la prima');
    setEditCotId(null);
    cargarOportunidades();
  }

  async function eliminarCotizacion(id: string) {
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    else cargarOportunidades();
  }

  const opsFiltradas = oportunidades.filter(o =>
    o.cliente?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // El pipeline se lee en orden de proceso, no por fecha de captura.
  const GRUPOS_PIPELINE: { titulo: string; chip: string; estados: string[] }[] = [
    { titulo: 'Por diagnosticar · entiende la necesidad primero', chip: 'lumo-chip-rojo', estados: ['Por diagnosticar'] },
    { titulo: 'Cotizando · consigue las primas', chip: 'lumo-chip-azul', estados: ['Cotizando'] },
    { titulo: 'Propuesta y negociación · empuja el cierre', chip: 'lumo-chip-negro', estados: ['Propuesta presentada', 'Negociación'] },
    { titulo: 'En emisión · dale seguimiento al trámite', chip: '', estados: ['Aceptada', 'Trámite en aseguradora', 'Emitida'] },
    { titulo: 'Cerradas', chip: '', estados: ['Ganada', 'Perdida'] },
  ];
  const estadosPipeline = GRUPOS_PIPELINE.flatMap(g => g.estados);
  const opsOtras = opsFiltradas.filter(o => !estadosPipeline.includes(o.estado));

  const chipEstadoCot = (estado: string) =>
    estado === 'Elegida' ? 'lumo-chip-azul'
    : estado === 'Descartada' ? 'lumo-chip-negro'
    : '';

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">
      <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-lg text-ink-soft leading-none mb-1">cotizaciones y embudo</p>
          <h1 className="text-4xl font-bold text-ink tracking-tight">Ventas</h1>
        </div>
        <div className="flex gap-2 mb-1">
          <Link href="/diagnosticos" className="text-xs text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold flex items-center gap-1.5">
            <Icon name="note" size={14} /> Diagnósticos
          </Link>
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className={`text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors ${mostrarForm ? 'bg-ink text-white' : 'lumo-btn-primary'}`}
          >
            <Icon name="plus" size={14} /> {mostrarForm ? 'Cerrar' : 'Nueva'}
          </button>
        </div>
      </header>

      <FlujoProceso
        paso={3}
        texto="Cada persona tiene UNA oportunidad que avanza por etapas; las cotizaciones por aseguradora viven adentro. Lo primero de la lista es lo que está más atrás en el proceso."
      />

      <main className="p-6 space-y-8">
        {mostrarForm && (
        <form onSubmit={guardarOportunidad} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="ventas" size={18} className="text-azul" /> Nueva Oportunidad
          </h2>
          <p className="font-hand text-base text-ink-soft -mt-2">
            una oportunidad por persona; las aseguradoras se cotizan adentro.
          </p>
          <div className="space-y-3">

            <label className="block text-xs text-ink-soft font-semibold">Seleccionar Persona:</label>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") setPersonaSeleccionada(null);
                else {
                  const [id, tipo] = val.split('-');
                  setPersonaSeleccionada({ id, tipo });
                }
              }}
              value={personaSeleccionada ? `${personaSeleccionada.id}-${personaSeleccionada.tipo}` : ""}
              className="lumo-input"
            >
              <option value="">-- Elige un Prospecto o Cliente --</option>
              {personas.map(p => (
                <option key={`${p.id}-${p.tipo}`} value={`${p.id}-${p.tipo}`}>
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

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Mis Oportunidades ({opsFiltradas.length})</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" placeholder="Buscar por cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="lumo-input pl-9" />
          </div>
        </div>

        <div className="space-y-6">
          {[
            ...GRUPOS_PIPELINE.map(g => ({ ...g, items: opsFiltradas.filter(o => g.estados.includes(o.estado)) })),
            { titulo: 'Otras', chip: '', estados: [], items: opsOtras },
          ].filter(g => g.items.length > 0).map(g => (
            <div key={g.titulo}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`lumo-chip ${g.chip}`}>{g.items.length}</span>
                <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wide">{g.titulo}</h3>
              </div>
              <div className="space-y-3">
                {g.items.map((o) => (
            <div key={o.id} className="lumo-card p-4">
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1">
                  <p className="font-bold text-ink">{o.cliente}</p>
                  <p className="text-sm text-ink-soft mt-0.5">{o.producto || 'Sin producto'}</p>
                  {/* Datos legado (modelo viejo: aseguradora/prima en la fila) */}
                  {(o.aseguradora || o.prima) && o.cotizaciones.length === 0 && (
                    <p className="text-xs text-ink-faint mt-1">
                      Registro anterior: {o.aseguradora || 'aseguradora s/d'} · {o.prima || 'sin prima'}
                    </p>
                  )}
                </div>
                <button onClick={() => eliminarOportunidad(o.id)} className="text-ink-faint hover:text-rojo p-1"><Icon name="trash" size={17} /></button>
              </div>

              {/* Cotizaciones por aseguradora */}
              <div className="mt-2 space-y-2">
                {o.cotizaciones.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-paper rounded-lg px-2.5 py-2">
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
                      className="text-[11px] border border-ink/15 rounded-md p-1 bg-card text-ink-soft"
                    >
                      {ESTADOS_COTIZACION.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => eliminarCotizacion(c.id)} className="text-ink-faint hover:text-rojo"><Icon name="trash" size={14} /></button>
                  </div>
                ))}

                {agregandoCotEn === o.id ? (
                  <form onSubmit={(e) => agregarCotizacion(e, o.id)} className="flex gap-2 items-center">
                    <select value={cotAseguradora} onChange={(e) => setCotAseguradora(e.target.value)} className="lumo-input py-2 text-sm w-2/5">
                      {ASEGURADORAS.map(a => <option key={a}>{a}</option>)}
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
              </div>

              <div className="mt-3 pt-3 border-t border-ink/10">
                <select value={o.estado} onChange={(e) => cambiarEstadoOportunidad(o.id, e.target.value)} className="text-xs border border-ink/15 rounded-lg p-2 bg-card text-ink-soft font-medium w-full focus:outline-none focus:border-azul">
                  {ESTADOS_OPORTUNIDAD.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
                ))}
              </div>
            </div>
          ))}
          {opsFiltradas.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron oportunidades</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
