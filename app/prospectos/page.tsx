"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, PageHeader, FlujoProceso } from '../components/lumo';
import LumoDictado from '../components/LumoDictado';
import { registrarActividad, sellarPrimerContacto } from '../lib/actividades';

type Prospecto = {
  id: string;
  nombre: string;
  telefono: string;
  producto: string;
  nota: string;
  estado: string;
  proxima_accion?: string;
  fecha_proxima?: string;
};

export default function Prospectos() {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [producto, setProducto] = useState('');
  const [nota, setNota] = useState('');
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editProducto, setEditProducto] = useState('');
  const [editNota, setEditNota] = useState('');

  useEffect(() => {
    cargarProspectos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarProspectos() {
    // RLS se encarga de filtrar, solo traemos los que no están convertidos/perdidos
    const { data, error } = await supabase
      .from('prospectos')
      .select('*')
      .order('created_at', { ascending: false })
      .neq('estado', 'Convertido')
      .neq('estado', 'Perdido');

    if (error) console.error("Error cargando:", error);
    if (data) setProspectos(data as Prospecto[]);
  }

  async function guardarProspecto(e: React.FormEvent) {
    e.preventDefault();

    // OBTENER EL ID DEL USUARIO ACTUAL
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("Tu sesión ha expirado."); return; }

    const { error } = await supabase.from('prospectos').insert([{
      nombre,
      telefono,
      producto,
      nota,
      estado: 'Nuevo',
      user_id: user.id // SELLAMOS EL DATO CON TU ID
    }]);

    if (error) {
      alert('Hubo un error al guardar');
    } else {
      setNombre(''); setTelefono(''); setProducto(''); setNota('');
      setMostrarForm(false);
      cargarProspectos();
    }
  }

  async function eliminarProspecto(id: string) {
    const { error } = await supabase.from('prospectos').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar');
    } else {
      cargarProspectos();
    }
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('prospectos').update({ estado: nuevoEstado }).eq('id', id);
    if (error) {
      alert('Error al actualizar');
    } else {
      void registrarActividad({
        tipo: 'etapa_cambiada',
        descripcion: `Etapa → ${nuevoEstado}`,
        prospecto_id: id,
      });
      cargarProspectos();
    }
  }

  function iniciarEdicion(p: Prospecto) {
    setEditandoId(p.id);
    setEditNombre(p.nombre);
    setEditTelefono(p.telefono);
    setEditProducto(p.producto);
    setEditNota(p.nota);
  }

  async function guardarEdicion(e: React.FormEvent, id: string) {
    e.preventDefault();
    const { error } = await supabase
      .from('prospectos')
      .update({ nombre: editNombre, telefono: editTelefono, producto: editProducto, nota: editNota })
      .eq('id', id);

    if (error) {
      alert('Error al guardar la edición');
    } else {
      setEditandoId(null);
      cargarProspectos();
    }
  }

  async function convertirACliente(p: Prospecto) {
    // Conversión TRANSACCIONAL en el servidor (RPC): crea el cliente,
    // migra citas/oportunidades/diagnósticos/trámites/servicios y sella
    // el prospecto en una sola transacción. O todo, o nada.
    const { error } = await supabase.rpc('convertir_prospecto_a_cliente', {
      p_prospecto_id: p.id,
    });

    if (error) {
      alert('No se pudo convertir: ' + error.message);
    } else {
      alert('🎉 ¡Venta Directa Registrada!\n\nCliente creado en tu cartera. Te agendé automáticamente una revisión postventa para dentro de 15 días.');
      cargarProspectos();
    }
  }

   function abrirWhatsApp(p: Prospecto) {
    let limpio = p.telefono.replace(/[^0-9]/g, '');
    if (limpio.length === 10) {
      limpio = '52' + limpio; // Agrega el 52 si es un número mexicano de 10 dígitos
    }
    // Línea de tiempo + sellado de primer contacto (speed-to-lead)
    void registrarActividad({
      tipo: 'contacto_whatsapp',
      descripcion: `WhatsApp abierto para ${p.nombre}`,
      prospecto_id: p.id,
    });
    void sellarPrimerContacto(p.id, 'whatsapp');
    window.open(`https://wa.me/${limpio}`, '_blank');
  }

  const prospectosFiltrados = prospectos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.telefono?.includes(busqueda)
  );

  // Orden de proceso: la lista se lee como un embudo, no como un archivo.
  const GRUPOS_ETAPA = [
    { estado: 'Nuevo',         titulo: 'Nuevos · haz el primer contacto',        chip: 'lumo-chip-rojo' },
    { estado: 'Contactado',    titulo: 'Contactados · agenda el diagnóstico',    chip: 'lumo-chip-azul' },
    { estado: 'Calificado',    titulo: 'Calificados · prepara la cotización',    chip: 'lumo-chip-negro' },
    { estado: 'Sin respuesta', titulo: 'Sin respuesta · decide: reintentar o soltar', chip: '' },
  ];
  const estadosConocidos = GRUPOS_ETAPA.map(g => g.estado);
  const otros = prospectosFiltrados.filter(p => !estadosConocidos.includes(p.estado));

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">

      <PageHeader titulo="Prospectos" subtitulo="nuevas oportunidades activas">
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className={`text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors ${mostrarForm ? 'bg-ink text-white' : 'lumo-btn-primary'}`}
        >
          <Icon name="plus" size={14} /> {mostrarForm ? 'Cerrar' : 'Nuevo'}
        </button>
      </PageHeader>

      <FlujoProceso
        paso={1}
        texto="Aquí viven las personas que aún NO te compran. El orden es: contactar → diagnosticar → cotizar. Cuando alguien compra, se convierte en Cliente y sale de esta lista."
      />

      <main className="p-6 space-y-8">

        {/* Formulario Captura Rápida (plegable) */}
        {mostrarForm && (
        <form onSubmit={guardarProspecto} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="edit" size={18} className="text-azul" /> Captura rápida
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
            <input
              type="tel"
              placeholder="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="lumo-input"
            />
            <select
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              className="lumo-input"
            >
              <option value="">Producto de interés...</option>
              <option value="Vida">Vida</option>
              <option value="Gastos Médicos">Gastos Médicos</option>
              <option value="Auto">Auto</option>
              <option value="Hogar">Hogar</option>
              <option value="Retiro">Retiro</option>
            </select>
            <textarea
              placeholder="Nota rápida..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="lumo-input resize-none"
              rows={2}
            />
          </div>
          <button type="submit" className="w-full lumo-btn-primary py-3">
            Guardar Prospecto
          </button>
        </form>
        )}

        {/* Barra de Búsqueda */}
        <div>
          <h2 className="lumo-section-title mb-3 px-1">Registros Activos ({prospectosFiltrados.length})</h2>
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

        {/* Lista de Prospectos agrupada por etapa del proceso */}
        <div className="space-y-6">
          {[
            ...GRUPOS_ETAPA.map(g => ({ ...g, items: prospectosFiltrados.filter(p => p.estado === g.estado) })),
            { estado: '__otros__', titulo: 'Otros', chip: '', items: otros },
          ].filter(g => g.items.length > 0).map(g => (
            <div key={g.estado}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`lumo-chip ${g.chip}`}>{g.items.length}</span>
                <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wide">{g.titulo}</h3>
              </div>
              <div className="space-y-3">
                {g.items.map((p) => (
            <div key={p.id} className="lumo-card p-4 hover:border-azul/50 transition-colors">
              {editandoId === p.id ? (
                /* Modo Edición */
                <form onSubmit={(e) => guardarEdicion(e, p.id)} className="space-y-3">
                  <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="lumo-input p-2" />
                  <input type="tel" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} className="lumo-input p-2" />
                  <select value={editProducto} onChange={(e) => setEditProducto(e.target.value)} className="lumo-input p-2">
                    <option value="">Sin producto</option>
                    <option value="Vida">Vida</option>
                    <option value="Gastos Médicos">Gastos Médicos</option>
                    <option value="Auto">Auto</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Retiro">Retiro</option>
                  </select>
                  <textarea value={editNota} onChange={(e) => setEditNota(e.target.value)} className="lumo-input p-2 resize-none" rows={2} />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 lumo-btn-primary py-2 text-sm">Guardar Cambios</button>
                    <button type="button" onClick={() => setEditandoId(null)} className="flex-1 lumo-btn-ghost py-2 text-sm">Cancelar</button>
                  </div>
                </form>
              ) : (
                /* Modo Vista */
                <>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Link href={`/prospectos/${p.id}`}>
                        <p className="font-bold text-ink hover:text-azul transition-colors flex items-center gap-1.5">
                          {p.nombre} <Icon name="search" size={13} className="text-ink-faint" />
                        </p>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-ink-soft flex items-center gap-1.5">
                          <Icon name="phone" size={14} /> {p.telefono || 'Sin teléfono'}
                        </span>
                        {p.telefono && (
                          <button onClick={() => abrirWhatsApp(p)} className="text-verde hover:text-verde text-xs bg-verde-soft px-2 py-1 rounded-md border border-verde/20 transition-colors font-semibold">WhatsApp</button>
                        )}
                      </div>
                      <p className="text-sm text-ink-soft mt-1">Interesado en: <span className="font-semibold text-ink">{p.producto || 'No especificado'}</span></p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicion(p)} className="text-ink-faint hover:text-azul p-1 transition-colors" title="Editar"><Icon name="edit" size={17} /></button>
                      <button onClick={() => eliminarProspecto(p.id)} className="text-ink-faint hover:text-rojo p-1 transition-colors" title="Eliminar"><Icon name="trash" size={17} /></button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-ink/10 flex justify-between items-center gap-2">
                    <select
                      value={p.estado}
                      onChange={(e) => cambiarEstado(p.id, e.target.value)}
                      className="text-xs border border-ink/15 rounded-lg p-2 bg-card focus:outline-none focus:border-azul text-ink-soft font-medium transition-all"
                    >
                      <option value="Nuevo">Nuevo</option>
                      <option value="Contactado">Contactado</option>
                      <option value="Calificado">Calificado</option>
                      <option value="Sin respuesta">Sin respuesta</option>
                      <option value="Perdido">Perdido</option>
                    </select>

                    <button
                      onClick={() => convertirACliente(p)}
                      className="text-xs bg-azul-soft text-azul border border-azul/30 hover:bg-azul hover:text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Icon name="rocket" size={14} /> Venta Directa
                    </button>
                  </div>
                </>
              )}
            </div>
                ))}
              </div>
            </div>
          ))}
          {prospectosFiltrados.length === 0 && (
            <div className="lumo-card lumo-lines p-6 border-dashed text-center">
              <p className="font-hand text-xl text-ink-faint">no hay prospectos activos con esos criterios</p>
            </div>
          )}
        </div>
      </main>

      {/* BOTÓN FLOTANTE DE LUMO DICTADO */}
      <LumoDictado />

      <BottomNav />
    </div>
  );
}