"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { BottomNav, Icon } from '../../components/lumo';

type Poliza = { id: string; producto: string; aseguradora: string; numero_poliza: string; vencimiento: string; estado: string };
type Oportunidad = { id: string; producto: string; prima: string; estado: string };
type Cita = { id: string; fecha: string; hora: string; tipo: string; estado: string };
type Servicio = { id: string; tipo: string; descripcion: string; estado: string };

export default function ExpedienteCliente() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clienteId = params.id as string;

  const [cliente, setCliente] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);

  const [formActivo, setFormActivo] = useState<string | null>(null);

  const [pAseguradora, setPAseguradora] = useState('AXA');
  const [pProducto, setPProducto] = useState('Vida');
  const [pPoliza, setPPoliza] = useState('');
  const [pVencimiento, setPVencimiento] = useState('');

  const [cFecha, setCFecha] = useState('');
  const [cHora, setCHora] = useState('');
  const [cTipo, setCTipo] = useState('Seguimiento');

  const [sTipo, setSTipo] = useState('Duda sobre póliza');
  const [sDesc, setSDesc] = useState('');

  useEffect(() => {
    if (clienteId) {
      cargarExpediente(clienteId);
      if (searchParams.get('nuevaPoliza') === 'true') {
        setFormActivo('poliza');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function cargarExpediente(id: string) {
    setCargando(true);
    const { data: cliData } = await supabase.from('clientes').select('*, polizas(*)').eq('id', id).single();
    if (cliData) {
      setCliente(cliData);
      setPolizas(cliData.polizas || []);

      const { data: ops } = await supabase.from('oportunidades').select('*').eq('cliente_id', id);
      if (ops) setOportunidades(ops as Oportunidad[]);

      const { data: cit } = await supabase.from('citas').select('*').eq('cliente_id', id);
      if (cit) setCitas(cit as Cita[]);

      const { data: serv } = await supabase.from('servicios').select('*').eq('cliente_id', id);
      if (serv) setServicios(serv as Servicio[]);
    }
    setCargando(false);
  }

  async function guardarPoliza(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('polizas').insert([{
      cliente_id: clienteId,
      aseguradora: pAseguradora,
      producto: pProducto,
      numero_poliza: pPoliza,
      vencimiento: pVencimiento,
      estado: 'Activa',
      user_id: user.id
    }]);
    if (error) alert('Error: ' + error.message);
    else { setFormActivo(null); setPPoliza(''); setPVencimiento(''); cargarExpediente(clienteId); }
  }

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('citas').insert([{
      titulo: cliente.nombre,
      fecha: cFecha,
      hora: cHora,
      tipo: cTipo,
      estado: 'Pendiente',
      cliente_id: clienteId,
      user_id: user.id
    }]);
    if (error) alert('Error: ' + error.message);
    else { setFormActivo(null); setCFecha(''); setCHora(''); cargarExpediente(clienteId); }
  }

  async function guardarServicio(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('servicios').insert([{
      cliente: cliente.nombre,
      tipo: sTipo,
      descripcion: sDesc,
      estado: 'Reportado',
      cliente_id: clienteId,
      user_id: user.id
    }]);
    if (error) alert('Error: ' + error.message);
    else { setFormActivo(null); setSDesc(''); cargarExpediente(clienteId); }
  }

  if (cargando) return <div className="min-h-screen flex items-center justify-center"><p className="font-hand text-xl text-ink-faint">cargando expediente...</p></div>;

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">
      <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-lg text-ink-soft leading-none mb-1">historial completo</p>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Expediente 360°</h1>
        </div>
        <Link href="/clientes" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Volver</Link>
      </header>

      <main className="p-5 space-y-8">

        <div className="lumo-card relative p-5">
          <span className="lumo-tape"></span>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-ink">{cliente?.nombre}</h2>
              <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5">
                <Icon name="phone" size={14} /> {cliente?.telefono || 'Sin teléfono'}
              </p>
            </div>
            {cliente?.telefono && (
              <a href={`https://wa.me/${cliente.telefono.replace(/[^0-9]/g, '').length === 10 ? '52' + cliente.telefono.replace(/[^0-9]/g, '') : cliente.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400 text-xs bg-green-950/50 px-3 py-2 rounded-md border border-green-900">WhatsApp</a>            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={() => setFormActivo(formActivo === 'poliza' ? null : 'poliza')} className={`text-xs font-bold py-2 rounded-lg transition-colors ${formActivo === 'poliza' ? 'bg-azul text-white' : 'bg-azul-soft text-azul border border-azul/20 hover:bg-azul hover:text-white'}`}>+ Póliza</button>
            <button onClick={() => setFormActivo(formActivo === 'cita' ? null : 'cita')} className={`text-xs font-bold py-2 rounded-lg transition-colors ${formActivo === 'cita' ? 'bg-ink text-white' : 'bg-paper text-ink border border-ink/15 hover:bg-ink hover:text-white'}`}>+ Cita</button>
            <button onClick={() => setFormActivo(formActivo === 'servicio' ? null : 'servicio')} className={`text-xs font-bold py-2 rounded-lg transition-colors ${formActivo === 'servicio' ? 'bg-rojo text-white' : 'bg-rojo-soft text-rojo border border-rojo/20 hover:bg-rojo hover:text-white'}`}>+ Servicio</button>
          </div>
        </div>

        {formActivo === 'poliza' && (
          <form onSubmit={guardarPoliza} className="lumo-card p-4 border-azul/40 space-y-3">
            <h3 className="font-bold text-azul text-sm uppercase tracking-wide">Nueva Póliza</h3>
            <div className="flex gap-2">
              <select value={pAseguradora} onChange={(e) => setPAseguradora(e.target.value)} className="lumo-input w-1/2 p-2 text-sm">
                <option>AXA</option><option>MetLife</option><option>GNP</option><option>Mapfre</option><option>Qualitas</option>
              </select>
              <select value={pProducto} onChange={(e) => setPProducto(e.target.value)} className="lumo-input w-1/2 p-2 text-sm">
                <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
              </select>
            </div>
            <input type="text" placeholder="No. de Póliza" value={pPoliza} onChange={(e) => setPPoliza(e.target.value)} className="lumo-input p-2 text-sm" />
            <input type="date" value={pVencimiento} onChange={(e) => setPVencimiento(e.target.value)} required className="lumo-input p-2 text-sm" />
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Guardar Póliza</button>
          </form>
        )}

        {formActivo === 'cita' && (
          <form onSubmit={guardarCita} className="lumo-card p-4 border-ink/30 space-y-3">
            <h3 className="font-bold text-ink text-sm uppercase tracking-wide">Agendar Cita</h3>
            <div className="flex gap-2">
              <input type="date" value={cFecha} onChange={(e) => setCFecha(e.target.value)} required className="lumo-input w-1/2 p-2 text-sm" />
              <input type="time" value={cHora} onChange={(e) => setCHora(e.target.value)} required className="lumo-input w-1/2 p-2 text-sm" />
            </div>
            <select value={cTipo} onChange={(e) => setCTipo(e.target.value)} className="lumo-input p-2 text-sm">
              <option>Seguimiento</option><option>Revisión de póliza</option><option>Renovación</option><option>Servicio</option><option>Videollamada</option>
            </select>
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Confirmar Cita</button>
          </form>
        )}

        {formActivo === 'servicio' && (
          <form onSubmit={guardarServicio} className="lumo-card p-4 border-rojo/40 space-y-3">
            <h3 className="font-bold text-rojo text-sm uppercase tracking-wide">Registrar Servicio</h3>
            <select value={sTipo} onChange={(e) => setSTipo(e.target.value)} className="lumo-input p-2 text-sm">
              <option>Duda sobre póliza</option><option>Cambio de datos</option><option>Aclaración de pago</option><option>Siniestro</option><option>Otro</option>
            </select>
            <textarea placeholder="¿Qué necesita o qué pasó?" value={sDesc} onChange={(e) => setSDesc(e.target.value)} required className="lumo-input p-2 text-sm resize-none" rows={3} />
            <button type="submit" className="w-full lumo-btn-danger py-2 text-sm">Guardar Servicio</button>
          </form>
        )}

        <div>
          <h3 className="lumo-section-title mb-3">Pólizas Contratadas</h3>
          <div className="space-y-2">
            {polizas.map(p => (
              <div key={p.id} className="lumo-card p-3 text-sm">
                <div className="flex justify-between text-ink">
                  <span className="font-semibold flex items-center gap-1.5"><Icon name="shield" size={14} className="text-azul" /> {p.producto}</span>
                  <span className="text-ink-faint">{p.aseguradora}</span>
                </div>
                <p className="text-ink-soft text-xs mt-1">Póliza: {p.numero_poliza || 'N/A'}</p>
                <p className="text-rojo text-xs mt-1 font-semibold">Vence: {p.vencimiento || 'N/A'}</p>
              </div>
            ))}
            {polizas.length === 0 && <p className="font-hand text-lg text-ink-faint">sin pólizas registradas</p>}
          </div>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Cotizaciones y Ventas</h3>
          <div className="space-y-2">
            {oportunidades.map(o => (
              <div key={o.id} className="lumo-card p-3 text-sm flex justify-between items-center">
                <div>
                  <p className="text-ink font-semibold">{o.producto}</p>
                  <p className="text-ink-soft text-xs">Prima: {o.prima || 'N/A'}</p>
                </div>
                <span className="lumo-chip lumo-chip-azul">{o.estado}</span>
              </div>
            ))}
            {oportunidades.length === 0 && <p className="font-hand text-lg text-ink-faint">sin cotizaciones registradas</p>}
          </div>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Historial de Citas</h3>
          <div className="space-y-2">
            {citas.map(c => (
              <div key={c.id} className="lumo-card p-3 text-sm flex justify-between items-center">
                <div>
                  <p className="text-ink font-semibold">{c.tipo}</p>
                  <p className="text-ink-soft text-xs">{c.fecha} a las {c.hora}</p>
                </div>
                <span className="lumo-chip">{c.estado}</span>
              </div>
            ))}
            {citas.length === 0 && <p className="font-hand text-lg text-ink-faint">sin citas registradas</p>}
          </div>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Servicios y Siniestros</h3>
          <div className="space-y-2">
            {servicios.map(s => (
              <div key={s.id} className="lumo-card p-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-ink font-semibold">{s.tipo}</p>
                  <span className="lumo-chip lumo-chip-rojo">{s.estado}</span>
                </div>
                <p className="text-ink-soft text-xs">{s.descripcion}</p>
              </div>
            ))}
            {servicios.length === 0 && <p className="font-hand text-lg text-ink-faint">sin servicios registrados</p>}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
