"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon, EncabezadoModulo, ProcessTabs, Buscador, FilaRegistro, ListaFilas, CargarMas, EstadoVacio } from '../components/lumo';
import { registrarActividad } from '../lib/actividades';
import { validarTelefonoOpcional, enlaceWhatsApp, formatearTelefono, type PaisTelefono } from '../lib/telefono';
import TelefonoInput from '../components/TelefonoInput';
import { toast } from '../components/Notificaciones';

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

const PASO = 20;

/* Días que faltan para una fecha (negativo = ya venció) */
function diasHasta(fecha?: string): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha + 'T00:00:00');
  if (isNaN(f.getTime())) return null;
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

/* Situación operativa del cliente: se entiende sin abrir la ficha */
function situacion(c: Cliente): {
  grupo: 'urgente' | 'activo' | 'renovacion' | 'sinpoliza';
  etiqueta: string;
  tono: 'rojo' | 'azul' | 'neutro';
  dias: number; /* para ordenar por urgencia */
} {
  if (!c.polizas || c.polizas.length === 0) {
    return { grupo: 'sinpoliza', etiqueta: 'Sin póliza · completar expediente', tono: 'neutro', dias: 9999 };
  }
  const dias = c.polizas.map(p => diasHasta(p.vencimiento)).filter((d): d is number => d !== null);
  if (dias.length === 0) {
    return { grupo: 'activo', etiqueta: 'Activo', tono: 'azul', dias: 9998 };
  }
  const min = Math.min(...dias);
  if (min < 0) return { grupo: 'urgente', etiqueta: `Vencida hace ${-min} día${min === -1 ? '' : 's'}`, tono: 'rojo', dias: min };
  if (min <= 30) return { grupo: 'urgente', etiqueta: `Renueva en ${min} día${min === 1 ? '' : 's'}`, tono: 'rojo', dias: min };
  if (min <= 90) return { grupo: 'renovacion', etiqueta: `Renueva en ${min} días`, tono: 'azul', dias: min };
  return { grupo: 'activo', etiqueta: 'Activo', tono: 'azul', dias: min };
}

const GRUPOS = [
  { id: 'urgente',    letra: 'A', titulo: 'Urgentes' },
  { id: 'activo',     letra: 'B', titulo: 'Activos' },
  { id: 'renovacion', letra: 'C', titulo: 'Renovación' },
  { id: 'sinpoliza',  letra: 'D', titulo: 'Sin póliza' },
] as const;
type GrupoId = typeof GRUPOS[number]['id'];

export default function Clientes() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefonoPais, setTelefonoPais] = useState<PaisTelefono>('MX');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState<GrupoId>('urgente');
  const [visibles, setVisibles] = useState(PASO);

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
    if (data) {
      const lista = data as Cliente[];
      setClientes(lista);
      // Si no hay urgentes, abrir en Activos para no aterrizar en vacío
      if (!lista.some(c => situacion(c).grupo === 'urgente')) setGrupoActivo(g => g === 'urgente' ? 'activo' : g);
    }
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
      setMostrarForm(false);
      toast('Cliente creado. Abre su expediente para registrar la póliza.', 'exito');
      cargarClientes();
    }
  }

  const q = busqueda.trim().toLowerCase();
  const buscados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q)
  );
  const conSituacion = buscados.map(c => ({ c, s: situacion(c) }));

  // Buscando: todos los grupos. Sin buscar: solo el grupo activo.
  // Orden: siempre lo más urgente arriba.
  const lista = (q ? conSituacion : conSituacion.filter(x => x.s.grupo === grupoActivo))
    .sort((a, b) => a.s.dias - b.s.dias);

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">

      <EncabezadoModulo
        titulo="Clientes"
        accion={
          <div className="flex items-center gap-2">
            <Link href="/servicios" className="text-xs text-rojo border border-rojo/25 bg-rojo-soft px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5">
              <Icon name="heart" size={14} /> Servicio
            </Link>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${mostrarForm ? 'bg-elevada text-ink border border-ink/15' : 'lumo-btn-primary'}`}
            >
              <Icon name="plus" size={15} /> {mostrarForm ? 'Cerrar' : 'Nuevo'}
            </button>
          </div>
        }
      >
        <ProcessTabs
          tabs={GRUPOS.map(g => ({ id: g.id, letra: g.letra, titulo: g.titulo, n: conSituacion.filter(x => x.s.grupo === g.id).length }))}
          activa={grupoActivo}
          onCambiar={(id) => { setGrupoActivo(id); setVisibles(PASO); }}
          alerta="urgente"
        />
        <Buscador
          valor={busqueda}
          onCambiar={(v) => { setBusqueda(v); setVisibles(PASO); }}
          placeholder="Buscar por nombre o teléfono…"
        />
      </EncabezadoModulo>

      <main className="p-4 space-y-4">

        {/* Alta de cliente: cerrada por defecto */}
        {mostrarForm && (
        <form onSubmit={guardarCliente} className="lumo-card p-5 space-y-4">
          <h2 className="font-semibold text-ink text-lg flex items-center gap-2">
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
        )}

        {!q && lista.length > 0 && (
          <p className="text-sm text-ink-soft px-1">
            {grupoActivo === 'urgente' && 'Pólizas vencidas o que vencen en 30 días. Atiéndelas primero.'}
            {grupoActivo === 'activo' && 'Cartera sana. Aquí se cultivan renovaciones y referidos.'}
            {grupoActivo === 'renovacion' && 'Renuevan en 31–90 días: contáctalos antes de que venza.'}
            {grupoActivo === 'sinpoliza' && 'Clientes sin póliza registrada: completa su expediente.'}
          </p>
        )}

        {lista.length > 0 ? (
          <>
            <ListaFilas>
              {lista.slice(0, visibles).map(({ c, s }) => {
                const pol = c.polizas?.[0];
                return (
                  <FilaRegistro
                    key={c.id}
                    nombre={c.nombre}
                    secundario={pol
                      ? `${pol.producto} · ${pol.aseguradora}${c.polizas.length > 1 ? ` +${c.polizas.length - 1}` : ''}`
                      : (c.telefono ? formatearTelefono(c.telefono) : 'sin teléfono')}
                    accion={s.etiqueta}
                    accionTono={s.tono}
                    onAbrir={() => router.push(`/clientes/${c.id}`)}
                    extremo={c.telefono ? (
                      <a
                        href={enlaceWhatsApp(c.telefono, c.telefono_pais)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-azul text-xs font-semibold border border-azul/30 bg-azul-soft px-2.5 py-1.5 rounded-lg"
                      >
                        WhatsApp
                      </a>
                    ) : undefined}
                  />
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
