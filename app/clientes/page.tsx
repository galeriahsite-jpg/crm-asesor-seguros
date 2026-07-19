"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, FlujoProceso } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { validarTelefonoOpcional, enlaceWhatsApp, formatearTelefono, type PaisTelefono } from '../lib/telefono';
import TelefonoInput from '../components/TelefonoInput';
import { toast, confirmarLumo } from '../components/Notificaciones';

type Poliza = {
  id: string;
  aseguradora: string;
  producto: string;
  numero_poliza: string;
  vencimiento: string;
  estado: string;
};

type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  telefono_pais?: string;
  estado: string;
  polizas: Poliza[];
};

export default function Clientes() {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefonoPais, setTelefonoPais] = useState<PaisTelefono>('MX');
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [nAseguradora, setNAseguradora] = useState('AXA');
  const [nProducto, setNProducto] = useState('Vida');
  const [nPoliza, setNPoliza] = useState('');
  const [nVencimiento, setNVencimiento] = useState('');

  const [busqueda, setBusqueda] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editTelefonoPais, setEditTelefonoPais] = useState<PaisTelefono>('MX');

  useEffect(() => {
    cargarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LumoCapture/Dictado avisan cuando crean datos: refrescar sin recargar.
  useEffect(() => {
    const refrescar = () => cargarClientes();
    window.addEventListener('lumo:datos-actualizados', refrescar);
    return () => window.removeEventListener('lumo:datos-actualizados', refrescar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('*, polizas(*)').order('created_at', { ascending: false });
    if (data) setClientes(data as Cliente[]);
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Teléfono opcional; si viene, debe cumplir la estructura del país.
    const tel = validarTelefonoOpcional(telefono, telefonoPais);
    if (!tel.ok) { toast(tel.error); return; }

    const { data: nuevo, error } = await supabase.from('clientes')
      .insert([{ nombre, telefono: tel.telefono, telefono_pais: tel.telefono ? telefonoPais : null, estado: 'Activo', user_id: user.id }])
      .select().single();
    if (error) {
      toast('Error al guardar cliente: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'cliente_creado',
        descripcion: `${nombre} · alta directa`,
        cliente_id: nuevo?.id,
      });
      setNombre(''); setTelefono('');
      cargarClientes();
    }
  }

  async function eliminarCliente(id: string) {
    if (!(await confirmarLumo({ titulo: 'Eliminar cliente', mensaje: 'Se eliminará el cliente y sus pólizas de referencia. Esta acción no se puede deshacer.', textoAceptar: 'Eliminar', peligro: true }))) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) {
      toast('Error al eliminar');
    } else {
      cargarClientes();
    }
  }

  function iniciarEdicion(c: Cliente) {
    setEditandoId(c.id);
    setEditNombre(c.nombre);
    setEditTelefono(c.telefono || '');
    setEditTelefonoPais((c.telefono_pais === 'US' ? 'US' : 'MX'));
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const tel = validarTelefonoOpcional(editTelefono, editTelefonoPais);
    if (!tel.ok) { toast(tel.error); return; }

    const { error } = await supabase
      .from('clientes')
      .update({ nombre: editNombre, telefono: tel.telefono, telefono_pais: tel.telefono ? editTelefonoPais : null })
      .eq('id', id);

    if (error) {
      toast('Error al guardar la edición');
    } else {
      setEditandoId(null);
      cargarClientes();
    }
  }

  async function guardarPoliza(e: React.FormEvent, clienteId: string) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('polizas').insert([{
      cliente_id: clienteId,
      aseguradora: nAseguradora,
      producto: nProducto,
      numero_poliza: nPoliza,
      vencimiento: nVencimiento,
      estado: 'Activa',
      user_id: user.id
    }]);

    if (error) {
      toast('Error al guardar póliza: ' + error.message);
    } else {
      void registrarActividad({
        tipo: 'poliza_registrada',
        descripcion: `${nProducto} · ${nAseguradora} · vence ${nVencimiento}`,
        cliente_id: clienteId,
      });
      setClienteSeleccionado(null);
      setNPoliza(''); setNVencimiento('');
      cargarClientes();
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda)
  );

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">

      <header className="px-5 pt-5 pb-2.5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-sm text-ink-soft leading-none mb-0.5">cartera y pólizas activas</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Clientes</h1>
        </div>
        <Link href="/servicios" className="text-xs text-rojo border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-rojo-soft font-semibold flex items-center gap-1.5 mb-1">
          <Icon name="heart" size={14} /> Servicio
        </Link>
      </header>

      <FlujoProceso
        paso={5}
        texto="Ya te compraron: aquí se cuida la relación. Registra sus pólizas, atiende sus servicios y llega a las renovaciones ANTES de que venzan. De aquí salen los referidos."
      />

      <main className="p-4 space-y-5">

        <form onSubmit={guardarCliente} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="plus" size={18} className="text-azul" /> Nuevo Cliente
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="lumo-input"
            />
            <TelefonoInput value={telefono} onChange={setTelefono} pais={telefonoPais} onChangePais={setTelefonoPais} placeholder="Teléfono (10 dígitos, opcional)" />
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">
            Crear Cliente
          </button>
        </form>

        <div className="mb-4">
          <h2 className="lumo-section-title mb-3">Expedientes</h2>
          <div className="relative mb-3">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="lumo-input pl-9"
            />
          </div>
        </div>

        <div className="space-y-4">
          {clientesFiltrados.map((c) => (
            <div key={c.id} className="lumo-card p-4">
              {editandoId === c.id ? (
                <form onSubmit={(e) => guardarEdicion(e, c.id)} className="space-y-3">
                  <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="lumo-input p-2" />
                  <TelefonoInput value={editTelefono} onChange={setEditTelefono} pais={editTelefonoPais} onChangePais={setEditTelefonoPais} className="lumo-input p-2" />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 lumo-btn-primary py-2 text-sm">Guardar Cambios</button>
                    <button type="button" onClick={() => setEditandoId(null)} className="flex-1 lumo-btn-ghost py-2 text-sm">Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/clientes/${c.id}`}>
                        <p className="font-bold text-ink hover:text-azul transition-colors flex items-center gap-1.5">
                          {c.nombre} <Icon name="search" size={13} className="text-ink-faint" />
                        </p>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-ink-soft flex items-center gap-1.5">
                          <Icon name="phone" size={14} /> {c.telefono ? formatearTelefono(c.telefono) : 'Sin teléfono'}
                        </span>
                        {c.telefono && (
                                                <a 
                        href={enlaceWhatsApp(c.telefono, c.telefono_pais)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-verde text-xs bg-verde-soft px-2 py-1 rounded-md border border-verde/20 font-semibold"
                      >
                        WhatsApp
                      </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicion(c)} className="text-ink-faint hover:text-azul p-2.5 -m-1.5" title="Editar"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarCliente(c.id)} className="text-ink-faint hover:text-rojo p-2.5 -m-1.5" title="Eliminar"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-ink/10 space-y-2">
                    {c.polizas && c.polizas.length > 0 ? (
                      c.polizas.map(p => (
                        <div key={p.id} className="bg-paper p-3 rounded-lg border border-ink/10 text-sm">
                          <div className="flex justify-between text-ink">
                            <span className="font-semibold">{p.producto}</span>
                            <span className="text-ink-faint">{p.aseguradora}</span>
                          </div>
                          <p className="text-sm text-ink-soft mt-1">Póliza: <span className="font-semibold text-ink">{p.numero_poliza || 'N/A'}</span></p>
                          <p className="text-sm text-rojo mt-1 font-semibold">Vence: {p.vencimiento || 'N/A'}</p>
                        </div>
                      ))
                    ) : (
                      <p className="font-hand text-base text-ink-faint">sin pólizas registradas</p>
                    )}

                    {clienteSeleccionado === c.id ? (
                      <form onSubmit={(e) => guardarPoliza(e, c.id)} className="mt-2 space-y-2 p-3 bg-paper rounded-lg border border-ink/10">
                        <div className="flex gap-2">
                          <select value={nAseguradora} onChange={(e) => setNAseguradora(e.target.value)} className="lumo-input w-1/2 p-2 text-xs">
                            <option>AXA</option><option>MetLife</option><option>GNP</option><option>Mapfre</option>
                          </select>
                          <select value={nProducto} onChange={(e) => setNProducto(e.target.value)} className="lumo-input w-1/2 p-2 text-xs">
                            <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option>
                          </select>
                        </div>
                        <input type="text" placeholder="No. Póliza" value={nPoliza} onChange={(e) => setNPoliza(e.target.value)} className="lumo-input p-2 text-xs" />
                        <input type="date" value={nVencimiento} onChange={(e) => setNVencimiento(e.target.value)} required className="lumo-input p-2 text-xs" />
                        <button type="submit" className="w-full lumo-btn-primary py-2 text-xs mt-1">Guardar Póliza</button>
                        <button type="button" onClick={() => setClienteSeleccionado(null)} className="w-full text-ink-faint py-1 text-xs">Cancelar</button>
                      </form>
                    ) : (
                      <button onClick={() => setClienteSeleccionado(c.id)} className="mt-2 text-xs text-azul font-bold hover:text-azul-dark flex items-center gap-1">
                        <Icon name="plus" size={13} /> Agregar Póliza
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {clientesFiltrados.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no se encontraron clientes</p>
            </div>
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
