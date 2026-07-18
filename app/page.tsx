"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav, Icon, SkeletonPantalla } from './components/lumo';
import { registrarActividad, sellarPrimerContacto, tiempoTranscurrido } from './lib/actividades';

export default function Home() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [totalRenovaciones, setTotalRenovaciones] = useState(0);
  const [totalLlamadas, setTotalLlamadas] = useState(0);
  const [prospectosOlvidados, setProspectosOlvidados] = useState(0);
  const [tramitesAtorados, setTramitesAtorados] = useState(0);

  type Decision = {
    clave: string;
    registroId: string;
    accion: 'reprogramar_prospecto' | 'reprogramar_cita' | 'contactar_lead' | 'agendar_renovacion' | 'agendar_tramite';
    nombre: string;
    pregunta: string;
    razon: string;
    etiquetaSi: string;
    href: string;               // a dónde lleva "Revisar"
    clienteId?: string | null;  // para agendar citas de renovación
    urgente?: boolean;
  };
  const [decisiones, setDecisiones] = useState<Decision[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setUsuarioEmail(session.user?.email || '');
        setCargando(false);
        cargarResumen();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LumoCapture/Dictado avisan cuando crean datos: refrescar sin recargar.
  useEffect(() => {
    const refrescar = () => cargarResumen();
    window.addEventListener('lumo:datos-actualizados', refrescar);
    return () => window.removeEventListener('lumo:datos-actualizados', refrescar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarResumen() {
    const { count: countPros } = await supabase
      .from('prospectos').select('*', { count: 'exact', head: true })
      .neq('estado', 'Convertido').neq('estado', 'Perdido');
    if (countPros !== null) setTotalProspectos(countPros);

    const hoy = new Date();
    const en30Dias = new Date();
    en30Dias.setDate(hoy.getDate() + 30);
    const hoyStr = hoy.toISOString().split('T')[0];
    const en30DiasStr = en30Dias.toISOString().split('T')[0];

    const { count: countRen } = await supabase
      .from('polizas').select('*', { count: 'exact', head: true })
      .gte('vencimiento', hoyStr).lte('vencimiento', en30DiasStr);
    if (countRen !== null) setTotalRenovaciones(countRen);

    const { count: countCitas } = await supabase
      .from('citas').select('*', { count: 'exact', head: true })
      .eq('estado', 'Pendiente');
    if (countCitas !== null) setTotalLlamadas(countCitas);

    const { count: countOlvidados } = await supabase
      .from('prospectos').select('*', { count: 'exact', head: true })
      .lt('fecha_proxima', hoyStr)
      .neq('estado', 'Convertido').neq('estado', 'Perdido');
    if (countOlvidados !== null) setProspectosOlvidados(countOlvidados);

    const { count: countAtorados } = await supabase
      .from('tramites').select('*', { count: 'exact', head: true })
      .in('estado', ['Información incompleta', 'Requisito adicional', 'Pago pendiente']);
    if (countAtorados !== null) setTramitesAtorados(countAtorados);

    cargarDecisiones(hoyStr);
  }

  // ── LUMO · Motor de siguiente mejor acción ──────────────────
  // Regla: ningún prospecto, cita, trámite o renovación abierta
  // se queda sin siguiente paso. Cada sugerencia explica su razón
  // y se resuelve en un toque.
  async function cargarDecisiones(hoyStr: string) {
    const lista: Decision[] = [];
    const en30Dias = new Date();
    en30Dias.setDate(en30Dias.getDate() + 30);
    const en30DiasStr = en30Dias.toISOString().split('T')[0];

    // 0. LEADS NUEVOS SIN PRIMER CONTACTO (lo más urgente: cada
    //    minuto sin respuesta baja la conversión).
    const { data: sinContacto } = await supabase
      .from('prospectos').select('id, nombre, created_at, fuente')
      .is('primer_contacto_at', null)
      .eq('estado', 'Nuevo')
      .order('created_at', { ascending: false }).limit(5);
    (sinContacto || []).forEach(p => lista.push({
      clave: `lc-${p.id}`, registroId: p.id, accion: 'contactar_lead', nombre: p.nombre,
      pregunta: '¿Hacer el primer contacto AHORA?',
      razon: `Llegó ${tiempoTranscurrido(p.created_at)}${p.fuente === 'landing' ? ' desde una landing' : ''} y nadie lo ha contactado. El objetivo es responder en menos de 5 minutos.`,
      etiquetaSi: 'Ya lo contacté',
      href: `/prospectos/${p.id}`,
      urgente: true,
    }));

    // 1. Prospectos activos SIN próxima acción definida
    const { data: sinAccion } = await supabase
      .from('prospectos').select('id, nombre, created_at')
      .is('fecha_proxima', null)
      .neq('estado', 'Convertido').neq('estado', 'Perdido')
      .order('created_at', { ascending: true }).limit(5);
    (sinAccion || []).forEach(p => lista.push({
      clave: `sa-${p.id}`, registroId: p.id, accion: 'reprogramar_prospecto', nombre: p.nombre,
      pregunta: '¿Programar seguimiento para mañana?',
      razon: 'No tiene próxima acción definida. Un prospecto sin siguiente paso se enfría.',
      etiquetaSi: 'Sí, mañana',
      href: `/prospectos/${p.id}`,
    }));

    // 2. Prospectos con seguimiento vencido
    const { data: vencidos } = await supabase
      .from('prospectos').select('id, nombre, proxima_accion, fecha_proxima')
      .lt('fecha_proxima', hoyStr)
      .neq('estado', 'Convertido').neq('estado', 'Perdido')
      .order('fecha_proxima', { ascending: true }).limit(5);
    (vencidos || []).forEach(p => lista.push({
      clave: `ve-${p.id}`, registroId: p.id, accion: 'reprogramar_prospecto', nombre: p.nombre,
      pregunta: '¿Reprogramar seguimiento vencido para mañana?',
      razon: `"${p.proxima_accion || 'Seguimiento'}" venció el ${p.fecha_proxima}.`,
      etiquetaSi: 'Sí, mañana',
      href: `/prospectos/${p.id}`,
    }));

    // 3. Citas pendientes con fecha pasada (sin resultado registrado)
    const { data: citasPasadas } = await supabase
      .from('citas').select('id, titulo, fecha, tipo')
      .eq('estado', 'Pendiente').lt('fecha', hoyStr)
      .order('fecha', { ascending: true }).limit(5);
    (citasPasadas || []).forEach(c => lista.push({
      clave: `cp-${c.id}`, registroId: c.id, accion: 'reprogramar_cita', nombre: c.titulo,
      pregunta: '¿Reprogramar esta cita para mañana?',
      razon: `La cita (${c.tipo}) era el ${c.fecha} y sigue marcada como pendiente, sin resultado.`,
      etiquetaSi: 'Sí, mañana',
      href: '/agenda',
    }));

    // 4. Renovaciones en 30 días → agendar llamada de renovación
    const { data: renovaciones } = await supabase
      .from('polizas')
      .select('id, vencimiento, producto, cliente_id, clientes(nombre)')
      .gte('vencimiento', hoyStr).lte('vencimiento', en30DiasStr)
      .order('vencimiento', { ascending: true }).limit(4);
    (renovaciones || []).forEach(pol => {
      const nombreCliente = (pol as unknown as { clientes?: { nombre?: string } }).clientes?.nombre || 'Cliente';
      lista.push({
        clave: `re-${pol.id}`, registroId: pol.id, accion: 'agendar_renovacion',
        nombre: nombreCliente,
        pregunta: '¿Agendar llamada de renovación para mañana?',
        razon: `Su póliza de ${pol.producto || 'seguro'} vence el ${pol.vencimiento}. Contactar antes evita perder la renovación.`,
        etiquetaSi: 'Agendar llamada',
        href: pol.cliente_id ? `/clientes/${pol.cliente_id}` : '/clientes',
        clienteId: pol.cliente_id,
      });
    });

    // 5. Trámites atorados → agendar revisión
    const { data: tramitesAt } = await supabase
      .from('tramites').select('id, cliente, folio, estado')
      .in('estado', ['Información incompleta', 'Requisito adicional', 'Pago pendiente'])
      .limit(3);
    (tramitesAt || []).forEach(t => lista.push({
      clave: `tr-${t.id}`, registroId: t.id, accion: 'agendar_tramite',
      nombre: t.cliente || `Trámite ${t.folio || ''}`,
      pregunta: '¿Agendar revisión del trámite para mañana?',
      razon: `El trámite${t.folio ? ` (folio ${t.folio})` : ''} está detenido: "${t.estado}". Cada día atorado retrasa la emisión.`,
      etiquetaSi: 'Agendar revisión',
      href: '/tramites',
    }));

    // Urgentes primero; máximo 10 para no abrumar.
    setDecisiones([...lista.filter(d => d.urgente), ...lista.filter(d => !d.urgente)].slice(0, 10));
  }

  async function resolverDecision(d: Decision, aceptar: boolean) {
    if (aceptar) {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      const mananaStr = manana.toISOString().split('T')[0];
      const { data: { user } } = await supabase.auth.getUser();

      if (d.accion === 'contactar_lead') {
        // "Ya lo contacté": sella el primer contacto y lo registra.
        await sellarPrimerContacto(d.registroId, 'otro');
        await registrarActividad({
          tipo: 'resultado_contacto',
          descripcion: 'Primer contacto confirmado desde el Centro de Decisiones',
          prospecto_id: d.registroId,
        });
      } else if (d.accion === 'reprogramar_prospecto') {
        await supabase.from('prospectos')
          .update({ fecha_proxima: mananaStr, proxima_accion: d.clave.startsWith('sa-') ? 'Dar seguimiento' : undefined })
          .eq('id', d.registroId);
      } else if (d.accion === 'reprogramar_cita') {
        await supabase.from('citas')
          .update({ fecha: mananaStr, estado: 'Reprogramada' })
          .eq('id', d.registroId);
      } else if (d.accion === 'agendar_renovacion' && user) {
        await supabase.from('citas').insert([{
          titulo: d.nombre, fecha: mananaStr, hora: '10:00', tipo: 'Renovación',
          estado: 'Pendiente', cliente_id: d.clienteId || null, user_id: user.id,
        }]);
        await registrarActividad({
          tipo: 'renovacion_contactada',
          descripcion: `Llamada de renovación agendada para ${mananaStr}`,
          cliente_id: d.clienteId || null,
        });
      } else if (d.accion === 'agendar_tramite' && user) {
        await supabase.from('citas').insert([{
          titulo: `Revisar trámite: ${d.nombre}`, fecha: mananaStr, hora: '10:00',
          tipo: 'Seguimiento', estado: 'Pendiente', user_id: user.id,
        }]);
      }
    }
    setDecisiones(prev => prev.filter(x => x.clave !== d.clave));
  }

  if (cargando) return <SkeletonPantalla titulo="Hoy" />;

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto relative">

      {/* Header LUMO */}
      <header className="px-5 pt-5 pb-2.5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Hoy</h1>
          </div>
          {usuarioEmail && (
            <p className="text-xs text-ink-faint mt-0.5 truncate max-w-[200px]">{usuarioEmail}</p>
          )}
        </div>
        <div className="flex gap-2 pb-1">
          <Link href="/mas" className="lumo-btn-ghost text-xs px-3 py-2 flex items-center gap-1.5">
            <Icon name="settings" size={14} /> Más
          </Link>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-xs text-rojo bg-card px-3 py-2 rounded-xl font-medium hover:bg-rojo-soft transition-colors border border-ink/15 flex items-center gap-1.5"
          >
            <Icon name="logout" size={14} /> Salir
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">

        {/* Alertas Rojas (Urgente) */}
        <div className="space-y-3">
          {prospectosOlvidados > 0 && (
            <Link href="/prospectos" className="block relative lumo-card border-l-4 border-l-rojo p-4 hover:shadow-md transition-shadow">
              <span className="lumo-tape"></span>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-rojo text-xs font-bold uppercase tracking-wider mb-1">Urgente</p>
                  <p className="text-ink font-bold text-lg">{prospectosOlvidados} prospectos olvidados</p>
                  <p className="font-hand text-base text-ink-soft mt-0.5">tienen seguimientos vencidos</p>
                </div>
                <Icon name="alert" size={30} className="text-rojo" />
              </div>
            </Link>
          )}

          {tramitesAtorados > 0 && (
            <Link href="/tramites" className="block lumo-card border-l-4 border-l-ink p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-ink-soft text-xs font-bold uppercase tracking-wider mb-1">Atención</p>
                  <p className="text-ink font-bold text-lg">{tramitesAtorados} trámites atorados</p>
                  <p className="font-hand text-base text-ink-soft mt-0.5">falta información o pago</p>
                </div>
                <Icon name="folder" size={30} className="text-ink-soft" />
              </div>
            </Link>
          )}
        </div>

        {/* LUMO · Centro de decisiones */}
        {decisiones.length > 0 && (
          <div>
            <h2 className="lumo-section-title mb-2 px-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-azul rounded flex items-center justify-center text-white"><Icon name="hoy" size={11} /></span>
              LUMO necesita tu decisión
            </h2>
            <div className="space-y-3">
              {decisiones.map(d => (
                <div key={d.clave} className={`lumo-card p-4 ${d.urgente ? 'border-l-4 border-l-rojo' : ''}`}>
                  {d.urgente && (
                    <p className="text-rojo text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Icon name="alert" size={12} /> Urgente · lead sin contactar</p>
                  )}
                  <p className="font-bold text-ink">{d.nombre}</p>
                  <p className="text-sm text-ink font-medium mt-0.5">{d.pregunta}</p>
                  <p className="text-xs text-ink-soft mt-1">{d.razon}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {d.urgente && (
                      <Link href={d.href} className="lumo-btn-danger px-4 py-2 text-xs">Abrir ficha</Link>
                    )}
                    <button
                      onClick={() => resolverDecision(d, true)}
                      className={`px-4 py-2 text-xs ${d.urgente ? 'lumo-btn-ghost' : 'lumo-btn-primary'}`}
                    >{d.etiquetaSi}</button>
                    {!d.urgente && (
                      <Link href={d.href} className="lumo-btn-ghost px-4 py-2 text-xs">Revisar</Link>
                    )}
                    <button
                      onClick={() => resolverDecision(d, false)}
                      className="text-ink-faint hover:text-ink text-xs px-2"
                    >Ignorar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas Principales (Cuaderno) */}
        <div>
          <h2 className="lumo-section-title mb-2 px-1">Tu Cuaderno</h2>
          <div className="grid grid-cols-2 gap-3">

            <Link href="/agenda" className="lumo-card px-3.5 py-3 hover:border-azul transition-colors flex items-center gap-3">
              <Icon name="phone" size={22} className="text-azul shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold text-ink tracking-tighter leading-none">{totalLlamadas}</p>
                <p className="text-sm text-ink-soft font-medium mt-0.5 leading-tight">Llamadas pendientes</p>
              </div>
            </Link>

            <Link href="/prospectos" className="lumo-card px-3.5 py-3 hover:border-azul transition-colors flex items-center gap-3">
              <Icon name="user" size={22} className="text-azul shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold text-ink tracking-tighter leading-none">{totalProspectos}</p>
                <p className="text-sm text-ink-soft font-medium mt-0.5 leading-tight">Prospectos activos</p>
              </div>
            </Link>

            <Link href="/clientes" className="col-span-2 bg-azul px-4 py-3 rounded-2xl shadow-sm hover:bg-azul-dark transition-colors flex items-center gap-3">
              <Icon name="refresh" size={22} className="text-white/80 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-white tracking-tighter leading-none">{totalRenovaciones}</p>
                <p className="text-sm text-white/80 font-medium mt-0.5 leading-tight">Renovaciones en 30 días</p>
              </div>
              <p className="text-azul text-xs font-bold uppercase tracking-wider bg-card px-3 py-1.5 rounded-full shrink-0">Atender</p>
            </Link>

          </div>
        </div>

        {/* Navegación Rápida (Diario) */}
        <div>
          <h2 className="lumo-section-title mb-2 px-1">Tu Diario</h2>
          <div className="lumo-card divide-y divide-ink/5 overflow-hidden">
            <Link href="/ventas" className="flex items-center justify-between px-3.5 py-3 hover:bg-paper transition-colors">
              <div className="flex items-center gap-3">
                <Icon name="ventas" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Ventas y Cotizaciones</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
            <Link href="/clientes" className="flex items-center justify-between px-3.5 py-3 hover:bg-paper transition-colors">
              <div className="flex items-center gap-3">
                <Icon name="clientes" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Clientes</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
            <Link href="/tramites" className="flex items-center justify-between px-3.5 py-3 hover:bg-paper transition-colors">
              <div className="flex items-center gap-3">
                <Icon name="doc" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Trámites</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
            <Link href="/metricas" className="flex items-center justify-between px-3.5 py-3 hover:bg-paper transition-colors">
              <div className="flex items-center gap-3">
                <Icon name="chart" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Métricas</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
          </div>
          <p className="font-hand text-base text-ink-soft text-center mt-3">
            menos ruido. más claridad. <span className="lumo-underline">más tú.</span>
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
