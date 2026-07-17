"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon } from '../components/lumo';

type Oportunidad = {
  id: string;
  cliente: string;
  producto: string;
  aseguradora: string;
  prima: string;
  estado: string;
};

export default function Ventas() {
  const [producto, setProducto] = useState('Vida');
  const [aseguradora, setAseguradora] = useState('AXA');
  const [prima, setPrima] = useState('');
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [personas, setPersonas] = useState<any[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{id: string, tipo: string} | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editPrima, setEditPrima] = useState('');

  useEffect(() => {
    cargarOportunidades();
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarOportunidades() {
    const { data } = await supabase.from('oportunidades').select('*').order('created_at', { ascending: false });
    if (data) setOportunidades(data as Oportunidad[]);
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

    const { error } = await supabase.from('oportunidades').insert([{
      cliente: nombreCliente,
      producto,
      aseguradora,
      prima,
      estado: 'Cotizando',
      prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
      cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      user_id: user.id
    }]);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      setPrima('');
      setPersonaSeleccionada(null);
      cargarOportunidades();
    }
  }

  async function eliminarOportunidad(id: string) {
    const { error } = await supabase.from('oportunidades').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    else cargarOportunidades();
  }

  async function cambiarEstadoOportunidad(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('oportunidades').update({ estado: nuevoEstado }).eq('id', id);
    if (error) alert('Error al actualizar');
    else cargarOportunidades();
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const { error } = await supabase.from('oportunidades').update({ prima: editPrima }).eq('id', id);
    if (error) alert('Error al guardar la edición');
    else { setEditandoId(null); cargarOportunidades(); }
  }

  const opsFiltradas = oportunidades.filter(o =>
    o.cliente?.toLowerCase().includes(busqueda.toLowerCase())
  );

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
          <Link href="/tramites" className="text-xs text-ink border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-paper font-semibold flex items-center gap-1.5">
            <Icon name="doc" size={14} /> Trámites
          </Link>
        </div>
      </header>

      <main className="p-5 space-y-8">
        <form onSubmit={guardarOportunidad} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="ventas" size={18} className="text-azul" /> Registrar Cotización
          </h2>
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

            <div className="flex gap-2">
              <select value={producto} onChange={(e) => setProducto(e.target.value)} className="lumo-input w-1/2">
                <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
              </select>
              <select value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} className="lumo-input w-1/2">
                <option>AXA</option><option>MetLife</option><option>Profuturo</option><option>GNP</option><option>Seguros Monterrey</option><option>Mapfre</option><option>Qualitas</option>
              </select>
            </div>
            <input type="text" placeholder="Prima anual (Ej: $12,000)" value={prima} onChange={(e) => setPrima(e.target.value)} className="lumo-input" />
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">Guardar Cotización</button>
        </form>

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Mis Oportunidades</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" placeholder="Buscar por cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="lumo-input pl-9" />
          </div>
        </div>

        <div className="space-y-3">
          {opsFiltradas.map((o) => (
            <div key={o.id} className="lumo-card p-4">
              {editandoId === o.id ? (
                <form onSubmit={(e) => guardarEdicion(e, o.id)} className="space-y-3">
                  <input type="text" value={editPrima} onChange={(e) => setEditPrima(e.target.value)} placeholder="Nueva prima" className="lumo-input p-2" />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 lumo-btn-primary py-2 text-sm">Guardar</button>
                    <button type="button" onClick={() => setEditandoId(null)} className="flex-1 lumo-btn-ghost py-2 text-sm">Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <p className="font-bold text-ink">{o.cliente}</p>
                      <div className="text-sm text-ink-soft flex justify-between mt-1">
                        <span>{o.producto} - {o.aseguradora}</span>
                        <span className="font-bold text-azul">{o.prima || 'Sin prima'}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditandoId(o.id); setEditPrima(o.prima || ''); }} className="text-ink-faint hover:text-azul p-1"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarOportunidad(o.id)} className="text-ink-faint hover:text-rojo p-1"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-ink/10">
                    <select value={o.estado} onChange={(e) => cambiarEstadoOportunidad(o.id, e.target.value)} className="text-xs border border-ink/15 rounded-lg p-2 bg-card text-ink-soft font-medium w-full focus:outline-none focus:border-azul">
                      <option value="Cotizando">Cotizando</option><option value="Propuesta presentada">Propuesta presentada</option><option value="Negociación">Negociación</option><option value="Aceptada">Aceptada</option><option value="Trámite en aseguradora">Trámite en aseguradora</option><option value="Emitida">Emitida</option><option value="Ganada">Ganada</option><option value="Perdida">Perdida</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          ))}
          {opsFiltradas.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron cotizaciones</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
