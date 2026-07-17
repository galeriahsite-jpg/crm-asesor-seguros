"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav, Icon } from './components/lumo';

export default function Home() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [totalRenovaciones, setTotalRenovaciones] = useState(0);
  const [totalLlamadas, setTotalLlamadas] = useState(0);
  const [prospectosOlvidados, setProspectosOlvidados] = useState(0);
  const [tramitesAtorados, setTramitesAtorados] = useState(0);

  type Decision = {
    clave: string;
    registroId: string;
    tabla: 'prospectos' | 'citas';
    nombre: string;
    pregunta: string;
    razon: string;
  };
  const [decisiones, setDecisiones] = useState<Decision[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setCargando(false);
        cargarResumen();
      }
    });
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

  // ── LUMO · Centro de decisiones ─────────────────────────────
  // Regla: ningún prospecto, cita o seguimiento abierto se queda
  // sin próxima acción. Cada sugerencia explica su razón.
  async function cargarDecisiones(hoyStr: string) {
    const lista: Decision[] = [];

    // 1. Prospectos activos SIN próxima acción definida
    const { data: sinAccion } = await supabase
      .from('prospectos').select('id, nombre, created_at')
      .is('fecha_proxima', null)
      .neq('estado', 'Convertido').neq('estado', 'Perdido')
      .order('created_at', { ascending: true }).limit(5);
    (sinAccion || []).forEach(p => lista.push({
      clave: `sa-${p.id}`, registroId: p.id, tabla: 'prospectos', nombre: p.nombre,
      pregunta: '¿Programar seguimiento para mañana?',
      razon: 'No tiene próxima acción definida. Un prospecto sin siguiente paso se enfría.',
    }));

    // 2. Prospectos con seguimiento vencido
    const { data: vencidos } = await supabase
      .from('prospectos').select('id, nombre, proxima_accion, fecha_proxima')
      .lt('fecha_proxima', hoyStr)
      .neq('estado', 'Convertido').neq('estado', 'Perdido')
      .order('fecha_proxima', { ascending: true }).limit(5);
    (vencidos || []).forEach(p => lista.push({
      clave: `ve-${p.id}`, registroId: p.id, tabla: 'prospectos', nombre: p.nombre,
      pregunta: '¿Reprogramar seguimiento vencido para mañana?',
      razon: `"${p.proxima_accion || 'Seguimiento'}" venció el ${p.fecha_proxima}.`,
    }));

    // 3. Citas pendientes con fecha pasada (sin resultado registrado)
    const { data: citasPasadas } = await supabase
      .from('citas').select('id, titulo, fecha, tipo')
      .eq('estado', 'Pendiente').lt('fecha', hoyStr)
      .order('fecha', { ascending: true }).limit(5);
    (citasPasadas || []).forEach(c => lista.push({
      clave: `cp-${c.id}`, registroId: c.id, tabla: 'citas', nombre: c.titulo,
      pregunta: '¿Reprogramar esta cita para mañana?',
      razon: `La cita (${c.tipo}) era el ${c.fecha} y sigue marcada como pendiente, sin resultado.`,
    }));

    setDecisiones(lista.slice(0, 8));
  }

  async function resolverDecision(d: Decision, aceptar: boolean) {
    if (aceptar) {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      const mananaStr = manana.toISOString().split('T')[0];

      if (d.tabla === 'prospectos') {
        await supabase.from('prospectos')
          .update({ fecha_proxima: mananaStr, proxima_accion: d.clave.startsWith('sa-') ? 'Dar seguimiento' : undefined })
          .eq('id', d.registroId);
      } else {
        await supabase.from('citas')
          .update({ fecha: mananaStr, estado: 'Reprogramada' })
          .eq('id', d.registroId);
      }
    }
    setDecisiones(prev => prev.filter(x => x.clave !== d.clave));
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-azul rounded-xl flex items-center justify-center text-card">
            <Icon name="hoy" size={26} />
          </div>
          <p className="text-ink-faint font-medium">Cargando tu sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto relative">

      {/* Header LUMO */}
      <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <img src="/logo.png" alt="Logo" className="w-12 h-12 rounded-xl mb-2" />
          <p className="font-hand text-lg text-ink-soft leading-none mb-1">tu espacio. tus ideas. tu día.</p>
          <h1 className="text-4xl font-bold text-ink tracking-tight">Hoy</h1>
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

      <main className="p-6 space-y-8">

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
            <h2 className="lumo-section-title mb-4 px-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-azul rounded flex items-center justify-center text-white"><Icon name="hoy" size={11} /></span>
              LUMO necesita tu decisión
            </h2>
            <div className="space-y-3">
              {decisiones.map(d => (
                <div key={d.clave} className="lumo-card p-4">
                  <p className="font-bold text-ink">{d.nombre}</p>
                  <p className="text-sm text-ink font-medium mt-0.5">{d.pregunta}</p>
                  <p className="font-hand text-base text-ink-soft mt-1">razón: {d.razon}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => resolverDecision(d, true)}
                      className="lumo-btn-primary px-4 py-2 text-xs"
                    >Sí, mañana</button>
                    <Link
                      href={d.tabla === 'prospectos' ? `/prospectos/${d.registroId}` : '/agenda'}
                      className="lumo-btn-ghost px-4 py-2 text-xs"
                    >Revisar</Link>
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
          <h2 className="lumo-section-title mb-4 px-1">Tu Cuaderno</h2>
          <div className="grid grid-cols-2 gap-4">

            <Link href="/agenda" className="lumo-card p-5 hover:border-azul transition-colors">
              <Icon name="phone" size={22} className="text-azul mb-4" />
              <p className="text-4xl font-bold text-ink tracking-tighter">{totalLlamadas}</p>
              <p className="text-xs text-ink-soft font-medium mt-1">Llamadas pendientes</p>
            </Link>

            <Link href="/prospectos" className="lumo-card p-5 hover:border-azul transition-colors">
              <Icon name="user" size={22} className="text-azul mb-4" />
              <p className="text-4xl font-bold text-ink tracking-tighter">{totalProspectos}</p>
              <p className="text-xs text-ink-soft font-medium mt-1">Prospectos activos</p>
            </Link>

            <Link href="/clientes" className="col-span-2 bg-azul p-5 rounded-2xl shadow-sm hover:bg-azul-dark transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <Icon name="refresh" size={22} className="text-white/80 mb-4" />
                  <p className="text-4xl font-bold text-white tracking-tighter">{totalRenovaciones}</p>
                  <p className="text-xs text-white/70 font-medium mt-1">Renovaciones en 30 días</p>
                </div>
                <div className="text-right">
                  <p className="text-azul text-xs font-bold uppercase tracking-wider bg-card px-3 py-1 rounded-full">Atender</p>
                </div>
              </div>
            </Link>

          </div>
        </div>

        {/* Navegación Rápida (Diario) */}
        <div>
          <h2 className="lumo-section-title mb-4 px-1">Tu Diario</h2>
          <div className="lumo-card divide-y divide-ink/5 overflow-hidden">
            <Link href="/ventas" className="flex items-center justify-between p-4 hover:bg-paper transition-colors">
              <div className="flex items-center gap-4">
                <Icon name="ventas" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Ventas y Cotizaciones</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
            <Link href="/clientes" className="flex items-center justify-between p-4 hover:bg-paper transition-colors">
              <div className="flex items-center gap-4">
                <Icon name="clientes" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Clientes</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
            <Link href="/tramites" className="flex items-center justify-between p-4 hover:bg-paper transition-colors">
              <div className="flex items-center gap-4">
                <Icon name="doc" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Trámites</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
            <Link href="/metricas" className="flex items-center justify-between p-4 hover:bg-paper transition-colors">
              <div className="flex items-center gap-4">
                <Icon name="chart" size={22} className="text-ink" />
                <span className="font-semibold text-ink">Métricas</span>
              </div>
              <Icon name="arrow" size={16} className="text-ink-faint" />
            </Link>
          </div>
          <p className="font-hand text-lg text-ink-soft text-center mt-5">
            menos ruido. más claridad. <span className="lumo-underline">más tú.</span>
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
