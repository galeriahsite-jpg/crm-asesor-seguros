"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BottomNav, Icon, PageHeader } from '../components/lumo';

type Cita = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  tipo: string;
  estado: string;
};

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

  useEffect(() => {
    cargarCitas();
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarCitas() {
    const { data } = await supabase.from('citas').select('*').order('fecha', { ascending: true });
    if (data) setCitas(data as Cita[]);
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
      alert('Debes seleccionar un prospecto o cliente para agendar la cita.');
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
      alert('Error al guardar: ' + error.message);
    } else {
      setFecha(''); setHora(''); setTipo('Llamada'); setPersonaSeleccionada(null);
      cargarCitas();
    }
  }

  async function eliminarCita(id: string) {
    const { error } = await supabase.from('citas').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    else cargarCitas();
  }

  async function cambiarEstadoCita(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', id);
    if (error) alert('Error al actualizar');
    else cargarCitas();
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
    if (error) alert('Error al guardar');
    else { setEditandoId(null); cargarCitas(); }
  }

  const citasFiltradas = citas.filter(c =>
    c.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.tipo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">
      <PageHeader titulo="Agenda" subtitulo="citas y compromisos" />

      <main className="p-5 space-y-8">
        <form onSubmit={guardarCita} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="calendar" size={18} className="text-azul" /> Agendar Nueva Cita
          </h2>
          <div className="space-y-3">

            <label className="block text-xs text-ink-soft font-semibold">Seleccionar Persona:</label>
            <select
              onChange={(e) => {
                if (e.target.value === "") setPersonaSeleccionada(null);
                else {
                  const [id, tipo, ...nombreParts] = e.target.value.split('-');
                  const nombre = nombreParts.join('-');
                  setPersonaSeleccionada({ id, tipo, nombre });
                }
              }}
              value={personaSeleccionada ? `${personaSeleccionada.id}-${personaSeleccionada.tipo}-${personaSeleccionada.nombre}` : ""}
              required
              className="lumo-input"
            >
              <option value="">-- Elige un Prospecto o Cliente --</option>
              {personas.map(p => (
                <option key={`${p.id}-${p.tipo}`} value={`${p.id}-${p.tipo}-${p.nombre}`}>
                  {p.nombre} ({p.tipo})
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="lumo-input w-1/2" />
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required className="lumo-input w-1/2" />
            </div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="lumo-input">
              <option>Llamada</option><option>Videollamada</option><option>Visita</option><option>Diagnóstico</option><option>Seguimiento</option><option>Servicio</option>
            </select>
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">Agregar a Agenda</button>
        </form>

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Próximas Citas</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" placeholder="Buscar cita..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="lumo-input pl-9" />
          </div>
        </div>

        <div className="space-y-3">
          {citasFiltradas.map((c) => (
            <div key={c.id} className="lumo-card p-4">
              {editandoId === c.id ? (
                <form onSubmit={(e) => guardarEdicion(e, c.id)} className="space-y-3">
                  <div className="flex gap-2">
                    <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="lumo-input w-1/2 p-2" />
                    <input type="time" value={editHora} onChange={(e) => setEditHora(e.target.value)} className="lumo-input w-1/2 p-2" />
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
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-ink">{c.titulo}</p>
                      <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5">
                        <Icon name="calendar" size={14} /> {c.fecha} a las {c.hora}
                      </p>
                      <span className="lumo-chip lumo-chip-azul mt-2">{c.tipo}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicion(c)} className="text-ink-faint hover:text-azul p-1" title="Editar"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarCita(c.id)} className="text-ink-faint hover:text-rojo p-1" title="Eliminar"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-ink/10">
                    <select value={c.estado} onChange={(e) => cambiarEstadoCita(c.id, e.target.value)} className="text-xs border border-ink/15 rounded-lg p-2 bg-card text-ink-soft font-medium w-full focus:outline-none focus:border-azul">
                      <option value="Pendiente">Pendiente</option><option value="Realizada">Realizada</option><option value="Cancelada">Cancelada</option><option value="No asistió">No asistió</option><option value="Reprogramada">Reprogramada</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          ))}
          {citasFiltradas.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron citas</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
