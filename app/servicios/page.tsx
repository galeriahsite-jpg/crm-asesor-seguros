"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, FlujoProceso } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { toast, confirmarLumo } from '../components/Notificaciones';

type Servicio = {
  id: string;
  cliente: string;
  tipo: string;
  descripcion: string;
  estado: string;
  nota: string;
};

export default function Servicios() {
  const [tipo, setTipo] = useState('Duda sobre póliza');
  const [descripcion, setDescripcion] = useState('');
  const [nota, setNota] = useState('');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editNota, setEditNota] = useState('');

  const [personas, setPersonas] = useState<any[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{id: string, nombre: string} | null>(null);

  useEffect(() => {
    cargarServicios();
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarServicios() {
    const { data } = await supabase.from('servicios').select('*').order('created_at', { ascending: false });
    if (data) setServicios(data as Servicio[]);
  }

  async function cargarPersonas() {
    const { data: pros } = await supabase.from('prospectos').select('id, nombre, estado').neq('estado', 'Convertido').neq('estado', 'Perdido');
    const { data: cli } = await supabase.from('clientes').select('id, nombre');
    const listaProspectos = (pros || []).map(p => ({ id: p.id, nombre: p.nombre, tipo: 'prospecto' }));
    const listaClientes = (cli || []).map(c => ({ id: c.id, nombre: c.nombre, tipo: 'cliente' }));
    setPersonas([...listaProspectos, ...listaClientes]);
  }

  async function guardarServicio(e: React.FormEvent) {
    e.preventDefault();
    if (!personaSeleccionada) {
      toast('Debes seleccionar un prospecto o cliente.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('servicios').insert([{
      cliente: personaSeleccionada.nombre,
      tipo,
      descripcion,
      nota,
      estado: 'Reportado',
      // En servicios generalmente es un cliente, pero si es prospecto guardamos prospecto_id
      cliente_id: personas.find(p => p.id === personaSeleccionada.id && p.tipo === 'cliente') ? personaSeleccionada.id : null,
      prospecto_id: personas.find(p => p.id === personaSeleccionada.id && p.tipo === 'prospecto') ? personaSeleccionada.id : null,
      user_id: user.id
    }]);

    if (error) {
      toast('Error al guardar: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'servicio_abierto',
        descripcion: `${tipo} · ${personaSeleccionada.nombre}`,
        prospecto_id: personas.find(p => p.id === personaSeleccionada.id && p.tipo === 'prospecto') ? personaSeleccionada.id : null,
        cliente_id: personas.find(p => p.id === personaSeleccionada.id && p.tipo === 'cliente') ? personaSeleccionada.id : null,
      });
      setDescripcion(''); setNota(''); setPersonaSeleccionada(null);
      cargarServicios();
    }
  }

  async function eliminarServicio(id: string) {
    if (!(await confirmarLumo({ mensaje: '¿Eliminar este servicio?', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('servicios').delete().eq('id', id);
    if (error) toast('Error al eliminar');
    else cargarServicios();
  }

  async function cambiarEstadoServicio(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('servicios').update({ estado: nuevoEstado }).eq('id', id);
    if (error) toast('Error al actualizar');
    else cargarServicios();
  }

  function iniciarEdicion(s: Servicio) {
    setEditandoId(s.id);
    setEditTipo(s.tipo);
    setEditDescripcion(s.descripcion);
    setEditNota(s.nota);
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const { error } = await supabase.from('servicios').update({ tipo: editTipo, descripcion: editDescripcion, nota: editNota }).eq('id', id);
    if (error) toast('Error al guardar la edición');
    else { setEditandoId(null); cargarServicios(); }
  }

  const serviciosFiltrados = servicios.filter(s =>
    s.cliente?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">
      <header className="px-5 pt-5 pb-2.5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-sm text-ink-soft leading-none mb-0.5">acompañamiento post-venta</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Servicio y Siniestros</h1>
        </div>
        <Link href="/clientes" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Volver</Link>
      </header>

      <FlujoProceso
        paso={5}
        texto="Postventa: cada solicitud del cliente se registra, se atiende y se cierra con seguimiento. Un buen servicio sostiene renovaciones y referidos."
      />

      <main className="p-4 space-y-5">
        <form onSubmit={guardarServicio} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="heart" size={18} className="text-rojo" /> Registrar Solicitud
          </h2>
          <div className="space-y-3">

            <label className="block text-xs text-ink-soft font-semibold">Seleccionar Persona:</label>
            <select
              onChange={(e) => {
                if (e.target.value === "") setPersonaSeleccionada(null);
                else {
                  const [id, , ...nombreParts] = e.target.value.split('|');
                  const nombre = nombreParts.join('|');
                  setPersonaSeleccionada({ id, nombre });
                }
              }}
              value={personaSeleccionada ? `${personaSeleccionada.id}|x|${personaSeleccionada.nombre}` : ""}
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

            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="lumo-input">
              <option>Duda sobre póliza</option><option>Cambio de datos</option><option>Aclaración de pago</option><option>Siniestro</option><option>Otro</option>
            </select>
            <textarea placeholder="¿Qué necesita o qué pasó?" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required className="lumo-input resize-none" rows={3} />
            <textarea placeholder="Nota interna (Ajustador, folio...)" value={nota} onChange={(e) => setNota(e.target.value)} className="lumo-input resize-none" rows={2} />
          </div>
          <button type="submit" className="w-full lumo-btn-danger py-3">Registrar Solicitud</button>
        </form>

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Casos Activos</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" placeholder="Buscar por cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="lumo-input pl-9" />
          </div>
        </div>

        <div className="space-y-3">
          {serviciosFiltrados.map((s) => (
            <div key={s.id} className="lumo-card p-4">
              {editandoId === s.id ? (
                <form onSubmit={(e) => guardarEdicion(e, s.id)} className="space-y-3">
                  <select value={editTipo} onChange={(e) => setEditTipo(e.target.value)} className="lumo-input p-2">
                    <option>Duda sobre póliza</option><option>Cambio de datos</option><option>Aclaración de pago</option><option>Siniestro</option><option>Otro</option>
                  </select>
                  <textarea value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} className="lumo-input p-2 resize-none" rows={3} />
                  <textarea value={editNota} onChange={(e) => setEditNota(e.target.value)} className="lumo-input p-2 resize-none" rows={2} />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 lumo-btn-primary py-2 text-sm">Guardar</button>
                    <button type="button" onClick={() => setEditandoId(null)} className="flex-1 lumo-btn-ghost py-2 text-sm">Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-ink">{s.cliente}</p>
                      <p className="text-xs text-rojo mt-1 font-bold uppercase tracking-wide">{s.tipo}</p>
                      <p className="text-sm text-ink-soft mt-2">{s.descripcion}</p>
                      {s.nota && <p className="text-sm font-hand text-ink-soft mt-2 bg-paper p-2 rounded-lg border border-ink/10">{s.nota}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicion(s)} className="text-ink-faint hover:text-azul p-2.5 -m-1.5" title="Editar"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarServicio(s.id)} className="text-ink-faint hover:text-rojo p-2.5 -m-1.5" title="Eliminar"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-ink/10">
                    <select value={s.estado} onChange={(e) => cambiarEstadoServicio(s.id, e.target.value)} className="text-xs border border-ink/15 rounded-lg p-2 bg-card text-ink-soft font-medium w-full focus:outline-none focus:border-azul">
                      <option value="Reportado">Reportado</option><option value="En proceso">En proceso</option><option value="Esperando respuesta">Esperando respuesta</option><option value="Resuelto">Resuelto</option><option value="Cerrado">Cerrado</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          ))}
          {serviciosFiltrados.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron solicitudes</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
