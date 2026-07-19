"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, FlujoProceso } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { toast, confirmarLumo } from '../components/Notificaciones';

type Tramite = {
  id: string;
  cliente: string;
  aseguradora: string;
  producto: string;
  folio: string;
  estado: string;
  nota: string;
};

export default function Tramites() {
  const [aseguradora, setAseguradora] = useState('AXA');
  const [producto, setProducto] = useState('Vida');
  const [folio, setFolio] = useState('');
  const [nota, setNota] = useState('');
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editFolio, setEditFolio] = useState('');
  const [editNota, setEditNota] = useState('');

  const [personas, setPersonas] = useState<any[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{id: string, tipo: string, nombre: string} | null>(null);

  useEffect(() => {
    cargarTramites();
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarTramites() {
    const { data } = await supabase.from('tramites').select('*').order('created_at', { ascending: false });
    if (data) setTramites(data as Tramite[]);
  }

  async function cargarPersonas() {
    const { data: pros } = await supabase.from('prospectos').select('id, nombre, estado').neq('estado', 'Convertido').neq('estado', 'Perdido');
    const { data: cli } = await supabase.from('clientes').select('id, nombre');
    const listaProspectos = (pros || []).map(p => ({ id: p.id, nombre: p.nombre, tipo: 'prospecto' }));
    const listaClientes = (cli || []).map(c => ({ id: c.id, nombre: c.nombre, tipo: 'cliente' }));
    setPersonas([...listaProspectos, ...listaClientes]);
  }

  async function guardarTramite(e: React.FormEvent) {
    e.preventDefault();
    if (!personaSeleccionada) {
      toast('Debes seleccionar un prospecto o cliente para iniciar el trámite.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('tramites').insert([{
      cliente: personaSeleccionada.nombre,
      aseguradora,
      producto,
      folio,
      nota,
      prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
      cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      user_id: user.id
    }]);

    if (error) {
      toast('Error al guardar: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'tramite_creado',
        descripcion: `${producto || 'Trámite'} · ${aseguradora || ''}${folio ? ` · folio ${folio}` : ''} · ${personaSeleccionada.nombre}`,
        prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
        cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      });
      setFolio(''); setNota(''); setPersonaSeleccionada(null);
      cargarTramites();
    }
  }

  async function eliminarTramite(id: string) {
    if (!(await confirmarLumo({ mensaje: '¿Eliminar este trámite?', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('tramites').delete().eq('id', id);
    if (error) toast('Error al eliminar');
    else cargarTramites();
  }

  async function cambiarEstadoTramite(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('tramites').update({ estado: nuevoEstado }).eq('id', id);
    if (error) toast('Error al actualizar');
    else cargarTramites();
  }

  function iniciarEdicion(t: Tramite) {
    setEditandoId(t.id);
    setEditFolio(t.folio);
    setEditNota(t.nota);
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const { error } = await supabase.from('tramites').update({ folio: editFolio, nota: editNota }).eq('id', id);
    if (error) toast('Error al guardar');
    else { setEditandoId(null); cargarTramites(); }
  }

  const tramitesFiltrados = tramites.filter(t =>
    t.cliente?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">
      <header className="px-5 pt-5 pb-2.5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-sm text-ink-soft leading-none mb-0.5">seguimiento aseguradoras</p>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Trámites</h1>
        </div>
        <button onClick={() => setMostrarForm(!mostrarForm)} className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors mb-1 ${mostrarForm ? 'bg-elevada text-ink border border-ink/15' : 'lumo-btn-primary'}`}>
          <Icon name="plus" size={15} /> {mostrarForm ? 'Cerrar' : 'Nuevo'}
        </button>
        <Link href="/ventas" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Volver</Link>
      </header>

      <FlujoProceso
        paso={4}
        texto="Entre la venta aceptada y la póliza emitida está el trámite. Destraba primero los atorados: información incompleta o pago pendiente detienen la emisión."
      />

      <main className="p-4 space-y-5">
{mostrarForm && (
        <form onSubmit={guardarTramite} className="lumo-card relative p-5 space-y-4">
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="doc" size={18} className="text-azul" /> Iniciar Trámite
          </h2>
          <div className="space-y-3">

            <label className="block text-xs text-ink-soft font-semibold">Seleccionar Persona:</label>
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

            <div className="flex gap-2">
              <select value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} className="lumo-input w-1/2">
                <option>AXA</option><option>MetLife</option><option>Profuturo</option><option>GNP</option><option>Seguros Monterrey</option><option>Mapfre</option><option>Qualitas</option>
              </select>
              <select value={producto} onChange={(e) => setProducto(e.target.value)} className="lumo-input w-1/2">
                <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
              </select>
            </div>
            <input type="text" placeholder="Folio oficial (si tienes)" value={folio} onChange={(e) => setFolio(e.target.value)} className="lumo-input" />
            <textarea placeholder="Notas (Faltan docs, en evaluación...)" value={nota} onChange={(e) => setNota(e.target.value)} className="lumo-input resize-none" rows={2} />
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">Guardar Trámite</button>
        </form>
        )}

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Trámites Activos</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" placeholder="Buscar por cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="lumo-input pl-9" />
          </div>
        </div>

        <div className="space-y-3">
          {tramitesFiltrados.map((t) => (
            <div key={t.id} className="lumo-card p-4">
              {editandoId === t.id ? (
                <form onSubmit={(e) => guardarEdicion(e, t.id)} className="space-y-3">
                  <input type="text" placeholder="Folio" value={editFolio} onChange={(e) => setEditFolio(e.target.value)} className="lumo-input p-2" />
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
                      <p className="font-bold text-ink">{t.cliente}</p>
                      <div className="text-sm text-ink-soft mt-1">
                        <p><span className="font-semibold text-ink">{t.producto}</span> · {t.aseguradora}</p>
                        {t.folio && <p>Folio: <span className="font-semibold text-ink">{t.folio}</span></p>}
                        {t.nota && <p className="mt-1 text-sm text-ink-soft bg-paper p-2 rounded-lg border border-ink/10">&ldquo;{t.nota}&rdquo;</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicion(t)} className="text-ink-faint hover:text-azul p-2.5 -m-1.5" title="Editar"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarTramite(t.id)} className="text-ink-faint hover:text-rojo p-2.5 -m-1.5" title="Eliminar"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-ink/10">
                    <select value={t.estado} onChange={(e) => cambiarEstadoTramite(t.id, e.target.value)} className="text-sm border border-ink/15 rounded-lg p-2 bg-card text-ink font-medium w-full focus:outline-none focus:border-azul">
                      <option value="Pendiente de iniciar">Pendiente de iniciar</option><option value="En captura">En captura</option><option value="Información incompleta">Información incompleta</option><option value="Enviado a aseguradora">Enviado a aseguradora</option><option value="En revisión">En revisión</option><option value="Requisito adicional">Requisito adicional</option><option value="Evaluación médica">Evaluación médica</option><option value="Contrapropuesta">Contrapropuesta</option><option value="Aceptado">Aceptado</option><option value="Pago pendiente">Pago pendiente</option><option value="Emitido">Emitido</option><option value="Rechazado">Rechazado</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          ))}
          {tramitesFiltrados.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron trámites</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
