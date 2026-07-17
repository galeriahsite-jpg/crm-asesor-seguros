"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BottomNav, Icon } from '../../components/lumo';

type Cita = { id: string; fecha: string; hora: string; tipo: string; estado: string };
type Oportunidad = { id: string; producto: string; aseguradora: string; prima: string; estado: string };
type Diagnostico = {
  id: string;
  que_proteger: string;
  riesgo_preocupante: string;
  producto_posible: string;
  aseguradoras_consultar: string;
  fecha_decision: string;
  nota: string;
  producto_sugerido?: string;
};

export default function FichaProspecto() {
  const params = useParams();
  const router = useRouter();
  const prospectoId = params.id as string;

  const [prospecto, setProspecto] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([]);

  const [nuevaAccion, setNuevaAccion] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');

  const [mostrarFormCita, setMostrarFormCita] = useState(false);
  const [citaFecha, setCitaFecha] = useState('');
  const [citaHora, setCitaHora] = useState('');
  const [citaTipo, setCitaTipo] = useState('Llamada');

  const [mostrarFormDiag, setMostrarFormDiag] = useState(false);
  const [dProteger, setDProteger] = useState('');
  const [dRiesgo, setDRiesgo] = useState('');
  const [dProductoPosible, setDProductoPosible] = useState('');
  const [dAseguradoras, setDAseguradoras] = useState('');
  const [dFechaDecision, setDFechaDecision] = useState('');
  const [dProximaAccion, setDProximaAccion] = useState('');

  const [mostrarFormOpp, setMostrarFormOpp] = useState(false);
  const [oppProducto, setOppProducto] = useState('Vida');
  const [oppAseguradora, setOppAseguradora] = useState('AXA');
  const [oppPrima, setOppPrima] = useState('');

  // Mensaje de primer contacto generado por LUMO (borrador editable)
  const [mensajeIA, setMensajeIA] = useState('');
  const [generandoMsg, setGenerandoMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function generarMensajeIA() {
    setGenerandoMsg(true);
    setErrorMsg('');
    setMensajeIA('');
    try {
      // La API solo recibe el ID; los datos reales los lee del CRM con tu sesión.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErrorMsg('Tu sesión ha expirado.'); setGenerandoMsg(false); return; }

      const res = await fetch('/api/generar-mensaje', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prospectoId }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'No se pudo generar el mensaje.');
      else setMensajeIA(data.mensaje);
    } catch {
      setErrorMsg('Error de conexión.');
    }
    setGenerandoMsg(false);
  }

  useEffect(() => {
    if (prospectoId) cargarFicha(prospectoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectoId]);

  async function cargarFicha(id: string) {
    setCargando(true);
    const { data: prospData } = await supabase.from('prospectos').select('*').eq('id', id).single();
    if (prospData) {
      setProspecto(prospData);
      const { data: cit } = await supabase.from('citas').select('*').eq('prospecto_id', id);
      if (cit) setCitas(cit as Cita[]);
      const { data: ops } = await supabase.from('oportunidades').select('*').eq('prospecto_id', id);
      if (ops) setOportunidades(ops as Oportunidad[]);
      const { data: diags } = await supabase.from('diagnosticos').select('*').eq('prospecto_id', id);
      if (diags) setDiagnosticos(diags as Diagnostico[]);
    }
    setCargando(false);
  }

  async function guardarProximaAccion(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('prospectos').update({ proxima_accion: nuevaAccion, fecha_proxima: nuevaFecha }).eq('id', prospectoId);
    if (error) alert('Error al guardar la acción');
    else { setNuevaAccion(''); setNuevaFecha(''); cargarFicha(prospectoId); }
  }

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('citas').insert([{
      titulo: prospecto.nombre, fecha: citaFecha, hora: citaHora, tipo: citaTipo, estado: 'Pendiente', prospecto_id: prospectoId, user_id: user.id
    }]);
    if (error) alert('Error al agendar');
    else { setMostrarFormCita(false); setCitaFecha(''); setCitaHora(''); setCitaTipo('Llamada'); cargarFicha(prospectoId); }
  }

  async function guardarDiagnostico(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('diagnosticos').insert([{
      cliente: prospecto.nombre,
      que_proteger: dProteger,
      riesgo_preocupante: dRiesgo,
      producto_posible: dProductoPosible,
      aseguradoras_consultar: dAseguradoras,
      fecha_decision: dFechaDecision,
      nota: dProximaAccion,
      producto_sugerido: dProductoPosible,
      prospecto_id: prospectoId,
      user_id: user.id
    }]);

    if (error) {
      alert('Error al guardar diagnóstico: ' + error.message);
    } else {
      await supabase.from('prospectos').update({ proxima_accion: dProximaAccion, fecha_proxima: dFechaDecision }).eq('id', prospectoId);
      setMostrarFormDiag(false);
      setDProteger(''); setDRiesgo(''); setDProductoPosible(''); setDAseguradoras(''); setDFechaDecision(''); setDProximaAccion('');
      cargarFicha(prospectoId);
    }
  }

  async function guardarOportunidad(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('oportunidades').insert([{
      cliente: prospecto.nombre, producto: oppProducto, aseguradora: oppAseguradora, prima: oppPrima, estado: 'Cotizando', prospecto_id: prospectoId, user_id: user.id
    }]);
    if (error) alert('Error al guardar cotización');
    else { setMostrarFormOpp(false); setOppPrima(''); cargarFicha(prospectoId); }
  }

  async function convertirACliente() {
    if (!prospecto) return;
    if (prospecto.cliente_id) {
      alert('Este prospecto ya fue convertido en cliente anteriormente.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: nuevoCliente, error: errorInsert } = await supabase
      .from('clientes')
      .insert([{ nombre: prospecto.nombre, telefono: prospecto.telefono, estado: 'Activo', user_id: user.id }])
      .select();

    if (errorInsert || !nuevoCliente || nuevoCliente.length === 0) {
      alert('Error al crear cliente: ' + errorInsert?.message);
      return;
    }

    const clienteId = nuevoCliente[0].id;

    await supabase.from('citas').update({ cliente_id: clienteId, user_id: user.id }).eq('prospecto_id', prospectoId);
    await supabase.from('oportunidades').update({ cliente_id: clienteId, user_id: user.id }).eq('prospecto_id', prospectoId);
    await supabase.from('diagnosticos').update({ cliente_id: clienteId, user_id: user.id }).eq('prospecto_id', prospectoId);
    await supabase.from('tramites').update({ cliente_id: clienteId, user_id: user.id }).eq('prospecto_id', prospectoId);

    const en15Dias = new Date();
    en15Dias.setDate(en15Dias.getDate() + 15);
    const fechaPostventa = en15Dias.toISOString().split('T')[0];

    const { error: errorUpdate } = await supabase
      .from('prospectos')
      .update({
        estado: 'Convertido',
        cliente_id: clienteId,
        proxima_accion: 'Llamar para revisión postventa y pedir referidos',
        fecha_proxima: fechaPostventa
      })
      .eq('id', prospectoId);

    if (errorUpdate) {
      alert('Error al actualizar el prospecto');
    } else {
      alert('🎉 ¡Venta Cerrada!\n\nCliente creado e historial migrado. Ahora te llevaré a su Expediente para registrar la póliza.');
      router.push(`/clientes/${clienteId}?nuevaPoliza=true`);
    }
  }

  if (cargando) return <div className="min-h-screen flex items-center justify-center"><p className="font-hand text-xl text-ink-faint">cargando ficha...</p></div>;

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">
      <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-lg text-ink-soft leading-none mb-1">historial completo</p>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Ficha del Prospecto</h1>
        </div>
        <Link href="/prospectos" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Volver</Link>
      </header>

      <main className="p-5 space-y-8">

        <div className="lumo-card relative p-5">
          <span className="lumo-tape"></span>
          <h2 className="text-xl font-bold text-ink">{prospecto?.nombre}</h2>
          <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5">
            <Icon name="phone" size={14} /> {prospecto?.telefono || 'Sin teléfono'}
          </p>
          <p className="text-sm text-azul font-semibold mt-1">Interés: {prospecto?.producto || 'No especificado'}</p>

          {prospecto?.nota && (
            <div className="mt-4 bg-paper lumo-lines p-3 rounded-lg border border-ink/10">
              <p className="text-xs text-ink-faint uppercase mb-1 font-bold tracking-wide">Nota Inicial</p>
              <p className="font-hand text-lg text-ink">&ldquo;{prospecto.nota}&rdquo;</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {prospecto?.telefono && (
             <a href={`https://wa.me/${prospecto.telefono.replace(/[^0-9]/g, '').length === 10 ? '52' + prospecto.telefono.replace(/[^0-9]/g, '') : prospecto.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-center text-sm bg-green-600/20 text-green-400 border border-green-800 font-medium py-2 rounded-lg hover:bg-green-600/40">WhatsApp</a>
            )}
            <button onClick={() => { setMostrarFormCita(!mostrarFormCita); setMostrarFormDiag(false); setMostrarFormOpp(false); }} className="text-center text-sm bg-azul-soft text-azul border border-azul/20 font-semibold py-2 rounded-lg hover:bg-azul hover:text-white transition-colors">Agendar Cita</button>
            <button onClick={() => { setMostrarFormDiag(!mostrarFormDiag); setMostrarFormCita(false); setMostrarFormOpp(false); }} className="text-center text-sm bg-paper text-ink border border-ink/15 font-semibold py-2 rounded-lg hover:bg-ink hover:text-white transition-colors">Diagnóstico</button>
            <button onClick={() => { setMostrarFormOpp(!mostrarFormOpp); setMostrarFormCita(false); setMostrarFormDiag(false); }} className="text-center text-sm bg-rojo-soft text-rojo border border-rojo/20 font-semibold py-2 rounded-lg hover:bg-rojo hover:text-white transition-colors">Cotizar</button>
            <button onClick={generarMensajeIA} disabled={generandoMsg} className="col-span-2 text-center text-sm bg-azul text-white font-semibold py-2 rounded-lg hover:bg-azul-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="edit" size={15} /> {generandoMsg ? 'Redactando...' : 'Mensaje LUMO'}
            </button>
          </div>

          {errorMsg && <p className="text-rojo text-sm font-medium bg-rojo-soft rounded-lg p-2 mt-3">{errorMsg}</p>}

          {mensajeIA && (
            <div className="mt-4 bg-paper lumo-lines p-3 rounded-lg border border-ink/10">
              <p className="text-xs text-ink-faint uppercase mb-2 font-bold tracking-wide">Borrador · revísalo antes de enviar</p>
              <textarea
                value={mensajeIA}
                onChange={(e) => setMensajeIA(e.target.value)}
                rows={5}
                className="w-full bg-transparent text-ink text-sm resize-none focus:outline-none"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => navigator.clipboard.writeText(mensajeIA)} className="lumo-btn-ghost px-3 py-2 text-xs">Copiar</button>
                {prospecto?.telefono && (
                  <a
                    href={`https://wa.me/${prospecto.telefono.replace(/[^0-9]/g, '').length === 10 ? '52' + prospecto.telefono.replace(/[^0-9]/g, '') : prospecto.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(mensajeIA)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-verde text-xs bg-verde-soft px-3 py-2 rounded-xl border border-verde/20 font-semibold"
                  >Enviar por WhatsApp</a>
                )}
              </div>
            </div>
          )}
        </div>

        {mostrarFormCita && (
          <form onSubmit={guardarCita} className="lumo-card p-4 border-azul/40 space-y-3">
            <h3 className="font-bold text-azul text-sm uppercase tracking-wide">Nueva Cita para {prospecto?.nombre}</h3>
            <div className="flex gap-2">
              <input type="date" value={citaFecha} onChange={(e) => setCitaFecha(e.target.value)} required className="lumo-input w-1/2 p-2 text-sm" />
              <input type="time" value={citaHora} onChange={(e) => setCitaHora(e.target.value)} required className="lumo-input w-1/2 p-2 text-sm" />
            </div>
            <select value={citaTipo} onChange={(e) => setCitaTipo(e.target.value)} className="lumo-input p-2 text-sm">
              <option>Llamada</option><option>Videollamada</option><option>Visita</option><option>Diagnóstico</option><option>Seguimiento</option>
            </select>
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Confirmar Cita</button>
          </form>
        )}

        {mostrarFormDiag && (
          <form onSubmit={guardarDiagnostico} className="lumo-card p-4 border-ink/30 space-y-3">
            <h3 className="font-bold text-ink text-sm uppercase tracking-wide">Descubrimiento de Necesidades</h3>

            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">1. ¿Qué desea proteger o lograr?</label>
              <input type="text" value={dProteger} onChange={(e) => setDProteger(e.target.value)} required className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">2. ¿Qué riesgo le preocupa?</label>
              <input type="text" value={dRiesgo} onChange={(e) => setDRiesgo(e.target.value)} required className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">3. ¿Qué producto puede tener sentido?</label>
              <input type="text" value={dProductoPosible} onChange={(e) => setDProductoPosible(e.target.value)} required placeholder="Ej: Vida, Gastos Médicos..." className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">4. ¿Qué aseguradoras conviene consultar?</label>
              <input type="text" value={dAseguradoras} onChange={(e) => setDAseguradoras(e.target.value)} required placeholder="Ej: AXA, MetLife" className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">5. ¿Cuándo podría tomar una decisión?</label>
              <input type="date" value={dFechaDecision} onChange={(e) => setDFechaDecision(e.target.value)} required className="lumo-input p-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-ink-soft font-semibold">6. ¿Cuál será la siguiente acción?</label>
              <input type="text" value={dProximaAccion} onChange={(e) => setDProximaAccion(e.target.value)} required placeholder="Ej: Enviar cotización el viernes" className="lumo-input p-2 text-sm" />
            </div>
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Guardar y Actualizar Seguimiento</button>
          </form>
        )}

        {mostrarFormOpp && (
          <form onSubmit={guardarOportunidad} className="lumo-card p-4 border-rojo/40 space-y-3">
            <h3 className="font-bold text-rojo text-sm uppercase tracking-wide">Registrar Cotización</h3>
            <div className="flex gap-2">
              <select value={oppProducto} onChange={(e) => setOppProducto(e.target.value)} className="lumo-input w-1/2 p-2 text-sm">
                <option>Vida</option><option>Gastos Médicos</option><option>Auto</option><option>Hogar</option><option>Retiro</option>
              </select>
              <select value={oppAseguradora} onChange={(e) => setOppAseguradora(e.target.value)} className="lumo-input w-1/2 p-2 text-sm">
                <option>AXA</option><option>MetLife</option><option>Profuturo</option><option>GNP</option><option>Mapfre</option>
              </select>
            </div>
            <input type="text" placeholder="Prima anual (Ej: $12,000)" value={oppPrima} onChange={(e) => setOppPrima(e.target.value)} className="lumo-input p-2 text-sm" />
            <button type="submit" className="w-full lumo-btn-primary py-2 text-sm">Guardar Cotización</button>
          </form>
        )}

        <div className="lumo-card border-l-4 border-l-rojo p-4">
          <p className="text-xs text-rojo uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
            <Icon name="alert" size={14} /> Próxima Acción
          </p>
          {prospecto?.proxima_accion ? (
            <div>
              <p className="text-ink font-semibold">{prospecto.proxima_accion}</p>
              <p className="text-ink-soft text-sm mt-1 flex items-center gap-1.5">
                <Icon name="calendar" size={14} /> {prospecto.fecha_proxima || 'Sin fecha'}
              </p>
            </div>
          ) : (
            <p className="font-hand text-lg text-ink-faint">no hay próxima acción definida</p>
          )}
          <form onSubmit={guardarProximaAccion} className="mt-4 pt-4 border-t border-ink/10 space-y-2">
            <p className="text-xs text-ink-soft font-semibold">Actualizar manualmente:</p>
            <input type="text" placeholder="Ej: Llamar el viernes..." value={nuevaAccion} onChange={(e) => setNuevaAccion(e.target.value)} required className="lumo-input p-2 text-sm" />
            <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} required className="lumo-input p-2 text-sm" />
            <button type="submit" className="w-full lumo-btn-danger py-2 text-sm">Guardar Acción</button>
          </form>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Descubrimientos Realizados</h3>
          <div className="space-y-2">
            {diagnosticos.map(d => (
              <div key={d.id} className="lumo-card p-3 text-sm">
                <div className="text-ink space-y-1">
                  <p><span className="text-ink-faint">Proteger:</span> {d.que_proteger || 'N/A'}</p>
                  <p><span className="text-ink-faint">Riesgo:</span> {d.riesgo_preocupante || 'N/A'}</p>
                  <p><span className="text-ink-faint">Producto:</span> <span className="text-azul font-semibold">{d.producto_posible || 'N/A'}</span></p>
                  <p><span className="text-ink-faint">Aseguradoras:</span> {d.aseguradoras_consultar || 'N/A'}</p>
                  <p><span className="text-ink-faint">Decisión:</span> {d.fecha_decision || 'N/A'}</p>
                  <p><span className="text-ink-faint">Acción:</span> <span className="text-rojo font-semibold">{d.nota || 'N/A'}</span></p>
                </div>
              </div>
            ))}
            {diagnosticos.length === 0 && <p className="font-hand text-lg text-ink-faint">sin diagnósticos registrados</p>}
          </div>
        </div>

        <div>
          <h3 className="lumo-section-title mb-3">Cotizaciones Relacionadas</h3>
          <div className="space-y-2">
            {oportunidades.map(o => (
              <div key={o.id} className="lumo-card p-3 text-sm flex justify-between items-center">
                <div>
                  <p className="text-ink font-semibold">{o.producto} <span className="text-ink-faint">({o.aseguradora})</span></p>
                  <p className="text-ink-soft text-xs">Prima: {o.prima || 'N/A'}</p>
                </div>
                <span className="lumo-chip lumo-chip-azul">{o.estado}</span>
              </div>
            ))}
            {oportunidades.length === 0 && <p className="font-hand text-lg text-ink-faint">aún no hay cotizaciones para este prospecto</p>}
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

        {prospecto?.estado !== 'Convertido' && (
          <div className="pt-4 border-t border-ink/10">
            <button onClick={convertirACliente} className="w-full lumo-btn-primary py-4 rounded-2xl flex items-center justify-center gap-2">
              <Icon name="rocket" size={18} /> Convertir en Cliente (Venta Directa)
            </button>
            <p className="text-center font-hand text-base text-ink-faint mt-2">¿el cliente compró sin embudo? úsalo sin culpa.</p>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
