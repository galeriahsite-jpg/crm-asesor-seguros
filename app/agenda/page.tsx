"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BottomNav, Icon, EncabezadoModulo, ProcessTabs, Buscador, FilaRegistro, ListaFilas, CargarMas, EstadoVacio } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { toast, confirmarLumo } from '../components/Notificaciones';
import { formatearFecha } from '../lib/fechas';

type Cita = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  tipo: string;
  estado: string;
};

const PASO = 20;

const GRUPOS = [
  { id: 'vencidas', letra: 'A', titulo: 'Vencidas' },
  { id: 'hoy',      letra: 'B', titulo: 'Hoy' },
  { id: 'proximas', letra: 'C', titulo: 'Próximas' },
  { id: 'historial',letra: 'D', titulo: 'Historial' },
] as const;
type GrupoId = typeof GRUPOS[number]['id'];

export default function Agenda() {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [tipo, setTipo] = useState('Llamada');
  const [citas, setCitas] = useState<Cita[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editFecha, setEditFecha] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editTipo, setEditTipo] = useState('Llamada');

  const [personas, setPersonas] = useState<any[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{id: string, tipo: string, nombre: string} | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState<GrupoId>('hoy');
  const [expandidaId, setExpandidaId] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PASO);

  useEffect(() => {
    cargarCitas(true);
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LumoCapture/Dictado avisan cuando crean datos: refrescar sin recargar.
  useEffect(() => {
    const refrescar = () => cargarCitas();
    window.addEventListener('lumo:datos-actualizados', refrescar);
    return () => window.removeEventListener('lumo:datos-actualizados', refrescar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarCitas(inicial = false) {
    const { data } = await supabase.from('citas').select('*').order('fecha', { ascending: true });
    if (data) {
      const lista = data as Cita[];
      setCitas(lista);
      if (inicial) {
        // Aterrizar donde hay trabajo: vencidas primero, si no, hoy
        const hoyStr = new Date().toISOString().split('T')[0];
        if (lista.some(c => c.estado === 'Pendiente' && c.fecha < hoyStr)) setGrupoActivo('vencidas');
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

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    if (!personaSeleccionada) {
      toast('Debes seleccionar un prospecto o cliente para agendar la cita.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('citas').insert([{
      titulo: personaSeleccionada.nombre,
      fecha,
      hora,
      tipo,
      estado: 'Pendiente',
      prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
      cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      user_id: user.id
    }]);

    if (error) {
      toast('Error al guardar: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'cita_creada',
        descripcion: `${tipo} · ${fecha} ${hora} · ${personaSeleccionada.nombre}`,
        prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
        cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      });
      setFecha(''); setHora(''); setTipo('Llamada'); setPersonaSeleccionada(null);
      setMostrarForm(false);
      cargarCitas();
    }
  }

  async function eliminarCita(id: string) {
    if (!(await confirmarLumo({ titulo: 'Eliminar cita', mensaje: 'Esta acción no se puede deshacer.', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('citas').delete().eq('id', id);
    if (error) toast('Error al eliminar');
    else { setExpandidaId(null); cargarCitas(); }
  }

  async function cambiarEstadoCita(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', id);
    if (error) toast('Error al actualizar');
    else {
      const cita = citas.find(c => c.id === id);
      if (nuevoEstado !== 'Pendiente') {
        void registrarActividad({
          tipo: 'cita_resultado',
          descripcion: `${cita?.tipo || 'Cita'} de ${cita?.titulo || ''} → ${nuevoEstado}`,
        });
      }
      setExpandidaId(null);
      cargarCitas();
    }
  }

  function iniciarEdicion(c: Cita) {
    setEditandoId(c.id);
    setEditFecha(c.fecha);
    setEditHora(c.hora);
    setEditTipo(c.tipo);
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const { error } = await supabase.from('citas').update({ fecha: editFecha, hora: editHora, tipo: editTipo }).eq('id', id);
    if (error) toast('Error al guardar');
    else { setEditandoId(null); setExpandidaId(null); cargarCitas(); }
  }

  const q = busqueda.trim().toLowerCase();
  const buscadas = citas.filter(c =>
    c.titulo?.toLowerCase().includes(q) || c.tipo?.toLowerCase().includes(q)
  );

  const hoyStr = new Date().toISOString().split('T')[0];
  const grupoDe = (c: Cita): GrupoId => {
    if (c.estado !== 'Pendiente') return 'historial';
    if (c.fecha < hoyStr) return 'vencidas';
    if (c.fecha === hoyStr) return 'hoy';
    return 'proximas';
  };

  // Buscando: todos los grupos. Sin buscar: solo el grupo activo.
  const lista = (q ? buscadas : buscadas.filter(c => grupoDe(c) === grupoActivo))
    .sort((a, b) => grupoDe(a) === 'historial' && grupoDe(b) === 'historial'
      ? (b.fecha + b.hora).localeCompare(a.fecha + a.hora)   /* historial: reciente primero */
      : (a.fecha + a.hora).localeCompare(b.fecha + b.hora)); /* pendientes: cronológico */

  function lineaAccion(c: Cita): { texto: string; tono: 'rojo' | 'azul' | 'neutro' } {
    const g = grupoDe(c);
    if (g === 'vencidas') return { texto: `Registrar resultado · era ${formatearFecha(c.fecha)}`, tono: 'rojo' };
    if (g === 'hoy') return { texto: `Hoy a las ${c.hora}`, tono: 'azul' };
    if (g === 'proximas') return { texto: `${formatearFecha(c.fecha)} · ${c.hora}`, tono: 'neutro' };
    return { texto: c.estado, tono: 'neutro' };
  }

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">

      <EncabezadoModulo
        titulo="Agenda"
        accion={
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${mostrarForm ? 'bg-elevada text-ink border border-ink/15' : 'lumo-btn-primary'}`}
          >
            <Icon name="plus" size={15} /> {mostrarForm ? 'Cerrar' : 'Nueva cita'}
          </button>
        }
      >
        <ProcessTabs
          tabs={GRUPOS.map(g => ({ id: g.id, letra: g.letra, titulo: g.titulo, n: buscadas.filter(c => grupoDe(c) === g.id).length }))}
          activa={grupoActivo}
          onCambiar={(id) => { setGrupoActivo(id); setVisibles(PASO); setExpandidaId(null); }}
          alerta="vencidas"
        />
        <Buscador
          valor={busqueda}
          onCambiar={(v) => { setBusqueda(v); setVisibles(PASO); }}
          placeholder="Buscar cita por nombre o tipo…"
        />
      </EncabezadoModulo>

      <main className="p-4 space-y-4">

        {/* Formulario: cerrado por defecto, abre con + Nueva cita */}
        {mostrarForm && (
        <form onSubmit={guardarCita} className="lumo-card p-5 space-y-4">
          <h2 className="font-semibold text-ink text-lg flex items-center gap-2">
            <Icon name="calendar" size={18} className="text-azul" /> Agendar Nueva Cita
          </h2>
          <div className="space-y-3">

            <div>
              <label className="block text-xs text-ink-soft font-semibold mb-1">¿Con quién?</label>
              <select
                onChange={(e) => {
                  if (e.target.value === "") setPersonaSeleccionada(null);
                  else {
                    const [id, tipo, ...nombreParts] = e.target.value.split('|');
                    const nombre = nombreParts.join('|');
                    setPersonaSeleccionada({ id, tipo, nombre });
                  }
                }}
                value={personaSeleccionada ? `${personaSeleccionada.id}|${personaSeleccionada.tipo}|${personaSeleccionada.nombre}` : ""}
                required
                className="lumo-input"
              >
                <option value="">-- Elige un Prospecto o Cliente --</option>
                {personas.map(p => (
                  <option key={`${p.id}-${p.tipo}`} value={`${p.id}|${p.tipo}|${p.nombre}`}>
                    {p.nombre} ({p.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-xs text-ink-soft font-semibold mb-1">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="lumo-input" />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-ink-soft font-semibold mb-1">Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required className="lumo-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-ink-soft font-semibold mb-1">Tipo de cita</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="lumo-input">
                <option>Llamada</option><option>Videollamada</option><option>Visita</option><option>Diagnóstico</option><option>Seguimiento</option><option>Servicio</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">Agregar a Agenda</button>
        </form>
        )}

        {!q && lista.length > 0 && grupoActivo === 'vencidas' && (
          <p className="text-sm text-rojo font-semibold px-1">Registra el resultado o reprograma. Una cita vencida sin resultado es un pendiente invisible.</p>
        )}

        {lista.length > 0 ? (
          <>
            <ListaFilas>
              {lista.slice(0, visibles).map((c) => {
                const a = lineaAccion(c);
                const abierta = expandidaId === c.id;
                return (
                  <div key={c.id}>
                    <FilaRegistro
                      nombre={c.titulo}
                      secundario={c.tipo}
                      accion={a.texto}
                      accionTono={a.tono}
                      onAbrir={() => { setExpandidaId(abierta ? null : c.id); setEditandoId(null); }}
                    />
                    {abierta && (
                      <div className="px-4 pb-4 bg-card space-y-3">
                        {editandoId === c.id ? (
                          <form onSubmit={(e) => guardarEdicion(e, c.id)} className="space-y-3 pt-1">
                            <div className="flex gap-2">
                              <div className="w-1/2">
                                <label className="block text-xs text-ink-soft font-semibold mb-1">Fecha</label>
                                <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="lumo-input p-2" />
                              </div>
                              <div className="w-1/2">
                                <label className="block text-xs text-ink-soft font-semibold mb-1">Hora</label>
                                <input type="time" value={editHora} onChange={(e) => setEditHora(e.target.value)} className="lumo-input p-2" />
                              </div>
                            </div>
                            <select value={editTipo} onChange={(e) => setEditTipo(e.target.value)} className="lumo-input p-2">
                              <option>Llamada</option><option>Videollamada</option><option>Visita</option><option>Diagnóstico</option><option>Seguimiento</option><option>Servicio</option>
                            </select>
                            <div className="flex gap-2">
                              <button type="submit" className="flex-1 lumo-btn-primary py-2 text-sm">Guardar</button>
                              <button type="button" onClick={() => setEditandoId(null)} className="flex-1 lumo-btn-ghost py-2 text-sm">Cancelar</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-ink-soft font-semibold mb-1">Resultado</label>
                              <select value={c.estado} onChange={(e) => cambiarEstadoCita(c.id, e.target.value)} className="text-sm border border-ink/15 rounded-lg p-2 bg-elevada text-ink font-medium w-full focus:outline-none focus:border-azul">
                                <option value="Pendiente">Pendiente</option><option value="Realizada">Realizada</option><option value="Cancelada">Cancelada</option><option value="No asistió">No asistió</option><option value="Reprogramada">Reprogramada</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => iniciarEdicion(c)} className="flex-1 lumo-btn-ghost py-2 text-sm flex items-center justify-center gap-1.5"><Icon name="edit" size={14} /> Reprogramar</button>
                              <button onClick={() => eliminarCita(c.id)} className="flex-1 lumo-btn-ghost py-2 text-sm text-rojo border-rojo/25 flex items-center justify-center gap-1.5"><Icon name="trash" size={14} /> Eliminar</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </ListaFilas>
            <CargarMas visibles={visibles} total={lista.length} onMas={() => setVisibles(v => v + PASO)} paso={PASO} />
          </>
        ) : (
          <EstadoVacio texto={q ? 'sin resultados con esa búsqueda' : 'nada pendiente en este grupo'} />
        )}
      </main>

      <BottomNav />
    </div>
  );
}
