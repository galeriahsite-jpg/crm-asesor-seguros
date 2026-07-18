"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav } from '../components/lumo';

export default function Metricas() {
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [totalCitas, setTotalCitas] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalPropuestas, setTotalPropuestas] = useState(0);
  const [primaTotal, setPrimaTotal] = useState(0);
  const [nombreMes, setNombreMes] = useState('');

  // Velocidad de respuesta (speed-to-lead)
  const [leadsMes, setLeadsMes] = useState(0);
  const [leadsSinContacto, setLeadsSinContacto] = useState(0);
  const [pctEn5Min, setPctEn5Min] = useState<number | null>(null);
  const [promedioMin, setPromedioMin] = useState<number | null>(null);

  useEffect(() => {
    // Obtener el nombre del mes actual en español
    const fecha = new Date();
    setNombreMes(fecha.toLocaleString('es-MX', { month: 'long' }));
    cargarMetricas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarMetricas() {
    // Calcular el primer y último día del mes actual
    const ahora = new Date();
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    const primerDiaStr = primerDia.toISOString().split('T')[0];
    const ultimoDiaStr = ultimoDia.toISOString().split('T')[0];

    // 1. Contar Prospectos de este mes
    const { count: cPros } = await supabase
      .from('prospectos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', primerDiaStr)
      .lte('created_at', ultimoDiaStr);
    if (cPros !== null) setTotalProspectos(cPros);

    // 2. Contar Citas de este mes
    const { count: cCitas } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', primerDiaStr)
      .lte('created_at', ultimoDiaStr);
    if (cCitas !== null) setTotalCitas(cCitas);

    // 3. Contar Clientes nuevos de este mes
    const { count: cClientes } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', primerDiaStr)
      .lte('created_at', ultimoDiaStr);
    if (cClientes !== null) setTotalClientes(cClientes);

    // 4. Contar Propuestas y Sumar Primas de este mes
    const { data: ops } = await supabase
      .from('oportunidades')
      .select('prima, estado')
      .gte('created_at', primerDiaStr)
      .lte('created_at', ultimoDiaStr);

    if (ops) {
      setTotalPropuestas(ops.length);

      const primasGanadas = ops.filter(o => o.estado === 'Ganada' || o.estado === 'Emitida' || o.estado === 'Aceptada');
      const total = primasGanadas.reduce((sum, o) => {
        const num = Number(o.prima?.replace(/[^0-9.-]+/g,"") || 0);
        return sum + num;
      }, 0);
      setPrimaTotal(total);
    }

    // 5. Velocidad de respuesta: leads de landing del mes
    const { data: leads } = await supabase
      .from('prospectos')
      .select('created_at, primer_contacto_at')
      .eq('fuente', 'landing')
      .gte('created_at', primerDiaStr)
      .lte('created_at', ultimoDiaStr);

    if (leads) {
      setLeadsMes(leads.length);
      setLeadsSinContacto(leads.filter(l => !l.primer_contacto_at).length);
      const contactados = leads.filter(l => l.primer_contacto_at);
      if (contactados.length > 0) {
        const minutos = contactados.map(l =>
          (new Date(l.primer_contacto_at as string).getTime() - new Date(l.created_at).getTime()) / 60000
        );
        setPctEn5Min(Math.round((minutos.filter(m => m <= 5).length / contactados.length) * 100));
        setPromedioMin(Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length));
      } else {
        setPctEn5Min(null);
        setPromedioMin(null);
      }
    }
  }

  // Cálculos de Conversión
  const convProspectoCliente = totalProspectos > 0 ? ((totalClientes / totalProspectos) * 100).toFixed(1) : 0;
  const convCitaPropuesta = totalCitas > 0 ? ((totalPropuestas / totalCitas) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen pb-28 max-w-md lg:max-w-xl mx-auto">

      <header className="px-5 pt-5 pb-2.5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-sm text-ink-soft leading-none mb-0.5 capitalize">indicadores de {nombreMes}</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Métricas</h1>
        </div>
        <Link href="/mas" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">
          ← Volver
        </Link>
      </header>

      <main className="p-4 space-y-5">

        {/* Sección de Producción */}
        <div>
          <h2 className="lumo-section-title mb-3">Producción del Mes (Prima Ganada)</h2>
          <div className="relative bg-azul p-6 rounded-2xl shadow-sm">
            <span className="lumo-tape"></span>
            <p className="text-sm text-white/80 font-medium">Total de Primas Emitidas/Ganadas</p>
            <p className="text-3xl font-bold text-white tracking-tighter mt-2">
              ${primaTotal.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
            </p>
            <p className="font-hand text-base text-white/70 mt-2">calculada automáticamente de tus ventas ganadas este mes</p>
          </div>
        </div>

        {/* Sección de Embudo de Conversión */}
        <div>
          <h2 className="lumo-section-title mb-3">Embudo de Conversión (Mensual)</h2>
          <div className="lumo-card p-5 space-y-4">

            <div className="flex justify-between items-center">
              <span className="text-sm text-ink font-medium">Prospectos a Clientes</span>
              <span className="text-lg font-bold text-azul">{convProspectoCliente}%</span>
            </div>
            <div className="w-full bg-paper rounded-full h-2 border border-ink/10">
              <div className="bg-azul h-full rounded-full" style={{ width: `${convProspectoCliente}%` }}></div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-ink font-medium">Citas a Propuestas</span>
              <span className="text-lg font-bold text-rojo">{convCitaPropuesta}%</span>
            </div>
            <div className="w-full bg-paper rounded-full h-2 border border-ink/10">
              <div className="bg-rojo h-full rounded-full" style={{ width: `${convCitaPropuesta}%` }}></div>
            </div>

          </div>
        </div>

        {/* Velocidad de respuesta (speed-to-lead) */}
        <div>
          <h2 className="lumo-section-title mb-3">Velocidad de Respuesta (Leads Web)</h2>
          <div className="lumo-card p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-ink">{leadsMes}</p>
                <p className="text-xs text-ink-soft font-medium mt-1">Leads del mes</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${pctEn5Min !== null && pctEn5Min >= 50 ? 'text-verde' : 'text-rojo'}`}>
                  {pctEn5Min !== null ? `${pctEn5Min}%` : '—'}
                </p>
                <p className="text-xs text-ink-soft font-medium mt-1">Contactados en 5 min</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{promedioMin !== null ? `${promedioMin} min` : '—'}</p>
                <p className="text-xs text-ink-soft font-medium mt-1">Promedio de respuesta</p>
              </div>
            </div>
            {leadsSinContacto > 0 && (
              <p className="text-rojo text-xs font-semibold mt-4 bg-rojo-soft rounded-lg p-2 text-center">
                {leadsSinContacto} lead{leadsSinContacto === 1 ? '' : 's'} del mes {leadsSinContacto === 1 ? 'sigue' : 'siguen'} sin primer contacto
              </p>
            )}
            <p className="font-hand text-base text-ink-soft mt-3 text-center">responder en 5 minutos multiplica la conversión</p>
          </div>
        </div>

        {/* Sección de Actividad */}
        <div>
          <h2 className="lumo-section-title mb-3 capitalize">Actividad de {nombreMes}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="lumo-card p-4">
              <p className="text-3xl font-bold text-ink">{totalProspectos}</p>
              <p className="text-xs text-ink-soft font-medium mt-1">Prospectos Nuevos</p>
            </div>
            <div className="lumo-card p-4">
              <p className="text-3xl font-bold text-ink">{totalCitas}</p>
              <p className="text-xs text-ink-soft font-medium mt-1">Citas Agendadas</p>
            </div>
            <div className="lumo-card p-4">
              <p className="text-3xl font-bold text-ink">{totalPropuestas}</p>
              <p className="text-xs text-ink-soft font-medium mt-1">Propuestas (Cotizaciones)</p>
            </div>
            <div className="lumo-card p-4">
              <p className="text-3xl font-bold text-ink">{totalClientes}</p>
              <p className="text-xs text-ink-soft font-medium mt-1">Clientes Nuevos</p>
            </div>
          </div>
          <p className="font-hand text-lg text-ink-soft text-center mt-6">enfócate en lo que importa.</p>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
