"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, FlujoProceso } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { toast, confirmarLumo } from '../components/Notificaciones';

type Diagnostico = {
  id: string;
  cliente: string;
  edad: string;
  dependientes: string;
  objetivo: string;
  presupuesto: string;
  producto_sugerido: string;
  nota: string;
};

export default function Diagnosticos() {
  const [edad, setEdad] = useState('');
  const [dependientes, setDependientes] = useState('');
  const [objetivo, setObjetivo] = useState('Proteger familia');
  const [presupuesto, setPresupuesto] = useState('');
  const [productoSugerido, setProductoSugerido] = useState('Vida');
  const [nota, setNota] = useState('');
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const [personas, setPersonas] = useState<any[]>([]);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{id: string, tipo: string, nombre: string} | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editEdad, setEditEdad] = useState('');
  const [editDependientes, setEditDependientes] = useState('');
  const [editObjetivo, setEditObjetivo] = useState('');
  const [editPresupuesto, setEditPresupuesto] = useState('');
  const [editSugerido, setEditSugerido] = useState('');
  const [editNota, setEditNota] = useState('');

  useEffect(() => {
    cargarDiagnosticos();
    cargarPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarDiagnosticos() {
    const { data } = await supabase.from('diagnosticos').select('*').order('created_at', { ascending: false });
    if (data) setDiagnosticos(data as Diagnostico[]);
  }

  async function cargarPersonas() {
    const { data: pros } = await supabase.from('prospectos').select('id, nombre, estado').neq('estado', 'Convertido').neq('estado', 'Perdido');
    const { data: cli } = await supabase.from('clientes').select('id, nombre');
    const listaProspectos = (pros || []).map(p => ({ id: p.id, nombre: p.nombre, tipo: 'prospecto' }));
    const listaClientes = (cli || []).map(c => ({ id: c.id, nombre: c.nombre, tipo: 'cliente' }));
    setPersonas([...listaProspectos, ...listaClientes]);
  }

  async function guardarDiagnostico(e: React.FormEvent) {
    e.preventDefault();
    if (!personaSeleccionada) {
      toast('Debes seleccionar un prospecto o cliente.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('diagnosticos').insert([{
      cliente: personaSeleccionada.nombre,
      edad,
      dependientes,
      objetivo,
      presupuesto,
      producto_sugerido: productoSugerido,
      nota,
      prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
      cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      user_id: user.id
    }]);

    if (error) {
      toast('Error al guardar el diagnóstico: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'diagnostico_creado',
        descripcion: `${personaSeleccionada.nombre} · sugerido: ${productoSugerido || 'por definir'}`,
        prospecto_id: personaSeleccionada.tipo === 'prospecto' ? personaSeleccionada.id : null,
        cliente_id: personaSeleccionada.tipo === 'cliente' ? personaSeleccionada.id : null,
      });
      setEdad(''); setDependientes(''); setPresupuesto(''); setNota(''); setPersonaSeleccionada(null);
      cargarDiagnosticos();
    }
  }

  async function eliminarDiagnostico(id: string) {
    if (!(await confirmarLumo({ mensaje: '¿Eliminar este diagnóstico?', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('diagnosticos').delete().eq('id', id);
    if (error) toast('Error al eliminar');
    else cargarDiagnosticos();
  }

  function iniciarEdicion(d: Diagnostico) {
    setEditandoId(d.id);
    setEditEdad(d.edad || '');
    setEditDependientes(d.dependientes || '');
    setEditObjetivo(d.objetivo || '');
    setEditPresupuesto(d.presupuesto || '');
    setEditSugerido(d.producto_sugerido || '');
    setEditNota(d.nota || '');
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const { error } = await supabase
      .from('diagnosticos')
      .update({
        edad: editEdad,
        dependientes: editDependientes,
        objetivo: editObjetivo,
        presupuesto: editPresupuesto,
        producto_sugerido: editSugerido,
        nota: editNota
      })
      .eq('id', id);

    if (error) {
      toast('Error al guardar la edición');
    } else {
      setEditandoId(null);
      cargarDiagnosticos();
    }
  }

  const diagsFiltrados = diagnosticos.filter(d =>
    d.cliente?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">
      <header className="px-5 pt-5 pb-2.5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-sm text-ink-soft leading-none mb-0.5">detección de necesidades</p>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Diagnósticos</h1>
        </div>
        <button onClick={() => setMostrarForm(!mostrarForm)} className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors mb-1 ${mostrarForm ? 'bg-elevada text-ink border border-ink/15' : 'lumo-btn-primary'}`}>
          <Icon name="plus" size={15} /> {mostrarForm ? 'Cerrar' : 'Nuevo'}
        </button>
        <Link href="/ventas" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Volver</Link>
      </header>

      <FlujoProceso
        paso={2}
        texto="Antes de cotizar, entiende: qué quiere proteger, qué riesgo le preocupa y cuánto puede invertir. Un buen diagnóstico hace que la cotización se venda sola."
      />

      <main className="p-4 space-y-5">

{mostrarForm && (
        <form onSubmit={guardarDiagnostico} className="lumo-card relative p-5 space-y-4">
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="note" size={18} className="text-azul" /> Nuevo Diagnóstico
          </h2>

          <div className="space-y-2">
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
          </div>

          <div className="flex gap-3">
            <input type="number" placeholder="Edad" value={edad} onChange={(e) => setEdad(e.target.value)} className="lumo-input w-1/2" />
            <input type="text" placeholder="Dependientes" value={dependientes} onChange={(e) => setDependientes(e.target.value)} className="lumo-input w-1/2" />
          </div>

          <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="lumo-input">
            <option>Proteger familia</option><option>Cubrir salud</option><option>Proteger patrimonio</option><option>Ahorrar / Retiro</option><option>Educación</option><option>Protección empresarial</option>
          </select>

          <input type="text" placeholder="Presupuesto (Ej: $2,000 mensual)" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} className="lumo-input" />

          <select value={productoSugerido} onChange={(e) => setProductoSugerido(e.target.value)} className="lumo-input">
            <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
          </select>

          <textarea placeholder="Notas de la conversación..." value={nota} onChange={(e) => setNota(e.target.value)} className="lumo-input resize-none" rows={2} />

          <button type="submit" className="w-full lumo-btn-primary py-3">Guardar Diagnóstico</button>
        </form>
        )}

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Historial</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="text" placeholder="Buscar por cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="lumo-input pl-9" />
          </div>
        </div>

        <div className="space-y-3">
          {diagsFiltrados.map((d) => (
            <div key={d.id} className="lumo-card p-4">
              {editandoId === d.id ? (
                <form onSubmit={(e) => guardarEdicion(e, d.id)} className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Edad" value={editEdad} onChange={(e) => setEditEdad(e.target.value)} className="lumo-input w-1/2 p-2" />
                    <input type="text" placeholder="Dependientes" value={editDependientes} onChange={(e) => setEditDependientes(e.target.value)} className="lumo-input w-1/2 p-2" />
                  </div>
                  <select value={editObjetivo} onChange={(e) => setEditObjetivo(e.target.value)} className="lumo-input p-2">
                    <option>Proteger familia</option><option>Cubrir salud</option><option>Proteger patrimonio</option><option>Ahorrar / Retiro</option><option>Educación</option><option>Protección empresarial</option>
                  </select>
                  <input type="text" placeholder="Presupuesto" value={editPresupuesto} onChange={(e) => setEditPresupuesto(e.target.value)} className="lumo-input p-2" />
                  <select value={editSugerido} onChange={(e) => setEditSugerido(e.target.value)} className="lumo-input p-2">
                    <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
                  </select>
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
                      <p className="font-bold text-ink">{d.cliente}</p>
                      <div className="text-sm text-ink-soft mt-2 space-y-1">
                        <p>Edad: {d.edad} · Dependientes: {d.dependientes || '0'}</p>
                        <p>Objetivo: <span className="text-ink font-semibold">{d.objetivo}</span></p>
                        <p>Presupuesto: <span className="text-ink font-semibold">{d.presupuesto || 'N/A'}</span></p>
                        <p className="text-azul font-bold mt-1 flex items-center gap-1">
                          <Icon name="star" size={13} /> Sugerencia: {d.producto_sugerido}
                        </p>
                      </div>
                      {d.nota && <p className="text-sm text-ink-soft mt-2 bg-paper p-2 rounded-lg border border-ink/10">&ldquo;{d.nota}&rdquo;</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicion(d)} className="text-ink-faint hover:text-azul p-2.5 -m-1.5" title="Editar"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarDiagnostico(d.id)} className="text-ink-faint hover:text-rojo p-2.5 -m-1.5" title="Eliminar"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          {diagsFiltrados.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron diagnósticos</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
