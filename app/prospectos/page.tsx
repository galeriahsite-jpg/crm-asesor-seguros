"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { BottomNav, Icon, EncabezadoModulo, ProcessTabs, Buscador, FilaRegistro, ListaFilas, CargarMas, EstadoVacio } from '../components/lumo';
import LumoDictado from '../components/LumoDictado';
import { registrarActividad, sellarPrimerContacto } from '../lib/actividades';
import { validarTelefonoOpcional, enlaceWhatsApp, verificarTelefonoReal, formatearTelefono, type PaisTelefono } from '../lib/telefono';
import TelefonoInput from '../components/TelefonoInput';
import { toast, confirmarLumo } from '../components/Notificaciones';

type Prospecto = {
  id: string;
  nombre: string;
  telefono: string;
  telefono_pais?: string;
  producto: string;
  nota: string;
  estado: string;
  proxima_accion?: string;
  fecha_proxima?: string;
};

/* El embudo ES la navegación: A→D en orden de trabajo */
const ETAPAS = [
  { id: 'Nuevo',         letra: 'A', titulo: 'Nuevos',       accion: 'Contactar ahora',       tono: 'rojo' as const },
  { id: 'Contactado',    letra: 'B', titulo: 'Contactados',  accion: 'Agendar diagnóstico',   tono: 'azul' as const },
  { id: 'Calificado',    letra: 'C', titulo: 'Calificados',  accion: 'Preparar cotización',   tono: 'azul' as const },
  { id: 'Sin respuesta', letra: 'D', titulo: 'Sin resp.',    accion: 'Reintentar o soltar',   tono: 'neutro' as const },
];
const PASO = 20;

export default function Prospectos() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefonoPais, setTelefonoPais] = useState<PaisTelefono>('MX');
  const [producto, setProducto] = useState('');
  const [nota, setNota] = useState('');
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [etapaActiva, setEtapaActiva] = useState('Nuevo');
  const [visibles, setVisibles] = useState(PASO);

  useEffect(() => {
    cargarProspectos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LumoCapture/Dictado avisan cuando crean datos: refrescar sin recargar.
  useEffect(() => {
    const refrescar = () => cargarProspectos();
    window.addEventListener('lumo:datos-actualizados', refrescar);
    return () => window.removeEventListener('lumo:datos-actualizados', refrescar);
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
    if (!user) { toast("Tu sesión ha expirado."); return; }

    // Teléfono opcional; si viene, debe cumplir la estructura del país.
    const tel = validarTelefonoOpcional(telefono, telefonoPais);
    if (!tel.ok) { toast(tel.error); return; }

    // Verificación REAL (nivel 4): solo actúa si hay proveedor
    // configurado (Twilio); si no, devuelve null y no estorba.
    if (tel.telefono) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const valido = await verificarTelefonoReal(tel.telefono, telefonoPais, session.access_token);
        if (valido === false && !(await confirmarLumo({ titulo: 'Número no verificado', mensaje: 'El verificador indica que este número NO parece válido.', textoAceptar: 'Guardar igual' }))) {
          return;
        }
      }
    }

    const { data: nuevo, error } = await supabase.from('prospectos').insert([{
      nombre,
      telefono: tel.telefono,
      telefono_pais: tel.telefono ? telefonoPais : null,
      producto,
      nota,
      estado: 'Nuevo',
      user_id: user.id // SELLAMOS EL DATO CON TU ID
    }]).select().single();

    if (error) {
      toast('Hubo un error al guardar');
    } else {
      void registrarActividad({
        tipo: 'prospecto_creado',
        descripcion: `${nombre}${producto ? ` · interés: ${producto}` : ''} · captura rápida`,
        prospecto_id: nuevo?.id,
      });
      setNombre(''); setTelefono(''); setProducto(''); setNota('');
      setMostrarForm(false);
      setEtapaActiva('Nuevo');
      cargarProspectos();
    }
  }

  function abrirWhatsApp(p: Prospecto) {
    // Línea de tiempo + sellado de primer contacto (speed-to-lead)
    void registrarActividad({
      tipo: 'contacto_whatsapp',
      descripcion: `WhatsApp abierto para ${p.nombre}`,
      prospecto_id: p.id,
    });
    void sellarPrimerContacto(p.id, 'whatsapp');
    // Prefijo correcto según el país del número (52 MX / 1 US).
    window.open(enlaceWhatsApp(p.telefono, p.telefono_pais), '_blank');
  }

  const q = busqueda.trim().toLowerCase();
  const buscados = prospectos.filter(p =>
    p.nombre?.toLowerCase().includes(q) || p.telefono?.includes(q)
  );

  // Buscando: resultados de TODAS las etapas. Sin buscar: solo la etapa activa.
  const lista = q ? buscados : buscados.filter(p => p.estado === etapaActiva);
  const etapaDe = (estado: string) => ETAPAS.find(e => e.id === estado);
  const etapa = etapaDe(etapaActiva) ?? ETAPAS[0];

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">

      <EncabezadoModulo
        titulo="Prospectos"
        accion={
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${mostrarForm ? 'bg-elevada text-ink border border-ink/15' : 'lumo-btn-primary'}`}
          >
            <Icon name="plus" size={15} /> {mostrarForm ? 'Cerrar' : 'Nuevo'}
          </button>
        }
      >
        <ProcessTabs
          tabs={ETAPAS.map(e => ({ id: e.id, letra: e.letra, titulo: e.titulo, n: buscados.filter(p => p.estado === e.id).length }))}
          activa={etapaActiva}
          onCambiar={(id) => { setEtapaActiva(id); setVisibles(PASO); }}
          alerta="Nuevo"
        />
        <Buscador
          valor={busqueda}
          onCambiar={(v) => { setBusqueda(v); setVisibles(PASO); }}
          placeholder="Buscar por nombre o teléfono…"
        />
      </EncabezadoModulo>

      <main className="p-4 space-y-4">

        {/* Formulario de captura: cerrado por defecto, abre con + Nuevo */}
        {mostrarForm && (
        <form onSubmit={guardarProspecto} className="lumo-card p-5 space-y-4">
          <h2 className="font-semibold text-ink text-lg flex items-center gap-2">
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
            <TelefonoInput value={telefono} onChange={setTelefono} pais={telefonoPais} onChangePais={setTelefonoPais} placeholder="Teléfono (10 dígitos, opcional)" />
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

        {/* Guía de la etapa: una línea, sin párrafos */}
        {!q && lista.length > 0 && (
          <p className="text-sm text-ink-soft px-1">
            {etapa.id === 'Nuevo' && 'Sin contactar todavía. El primer contacto rápido lo es todo.'}
            {etapa.id === 'Contactado' && 'Ya hubo contacto: el siguiente paso es el diagnóstico.'}
            {etapa.id === 'Calificado' && 'Necesidad clara: prepara la cotización en Ventas.'}
            {etapa.id === 'Sin respuesta' && 'Decide: un último intento o soltar sin culpa.'}
          </p>
        )}

        {lista.length > 0 ? (
          <>
            <ListaFilas>
              {lista.slice(0, visibles).map((p) => {
                const e = etapaDe(p.estado);
                return (
                  <FilaRegistro
                    key={p.id}
                    nombre={p.nombre}
                    secundario={`${p.producto || 'Sin producto'} · ${p.telefono ? formatearTelefono(p.telefono) : 'sin teléfono'}`}
                    accion={e?.accion}
                    accionTono={e?.tono}
                    badge={q ? e?.titulo ?? p.estado : undefined}
                    badgeTono={e?.tono === 'rojo' ? 'rojo' : 'neutro'}
                    onAbrir={() => router.push(`/prospectos/${p.id}`)}
                    extremo={p.telefono ? (
                      <button
                        onClick={() => abrirWhatsApp(p)}
                        className="text-azul text-xs font-semibold border border-azul/30 bg-azul-soft px-2.5 py-1.5 rounded-lg"
                      >
                        WhatsApp
                      </button>
                    ) : undefined}
                  />
                );
              })}
            </ListaFilas>
            <CargarMas visibles={visibles} total={lista.length} onMas={() => setVisibles(v => v + PASO)} paso={PASO} />
          </>
        ) : (
          <EstadoVacio texto={q ? 'sin resultados con esa búsqueda' : `nada pendiente en ${etapa.titulo.toLowerCase()}`} />
        )}

        {prospectos.length === 0 && !mostrarForm && (
          <button onClick={() => setMostrarForm(true)} className="w-full lumo-btn-primary px-5 py-3">
            Crear tu primer prospecto
          </button>
        )}
      </main>

      {/* BOTÓN FLOTANTE DE LUMO DICTADO (se oculta con formulario abierto) */}
      {!mostrarForm && <LumoDictado />}

      <BottomNav />
    </div>
  );
}
