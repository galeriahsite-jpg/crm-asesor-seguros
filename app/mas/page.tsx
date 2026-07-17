"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Link from 'next/link';
import { BottomNav, Icon } from '../components/lumo';

type Aseguradora = {
  id: string;
  nombre: string;
  portal_url: string;
  usuario: string;
  ejecutivo: string;
  telefono: string;
};

export default function Mas() {
  const [nombre, setNombre] = useState('AXA');
  const [portalUrl, setPortalUrl] = useState('');
  const [usuario, setUsuario] = useState('');
  const [ejecutivo, setEjecutivo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);

  useEffect(() => {
    cargarAseguradoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarAseguradoras() {
    const { data } = await supabase.from('aseguradoras').select('*').order('nombre', { ascending: true });
    if (data) setAseguradoras(data as Aseguradora[]);
  }

  async function guardarAseguradora(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('aseguradoras').insert([{
      nombre, portal_url: portalUrl, usuario, ejecutivo, telefono, user_id: user.id
    }]);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      setPortalUrl(''); setUsuario(''); setEjecutivo(''); setTelefono('');
      cargarAseguradoras();
    }
  }

  async function eliminarAseguradora(id: string) {
    const { error } = await supabase.from('aseguradoras').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    else cargarAseguradoras();
  }

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto">

      <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
        <div>
          <p className="font-hand text-lg text-ink-soft leading-none mb-1">directorio y herramientas</p>
          <h1 className="text-4xl font-bold text-ink tracking-tight">Configuración</h1>
        </div>
        <Link href="/" className="text-sm text-azul border border-ink/15 bg-card px-3 py-2 rounded-xl hover:bg-azul-soft font-semibold mb-1">← Inicio</Link>
      </header>

      <main className="p-5 space-y-8">

        <Link href="/metricas" className="bg-azul p-4 rounded-2xl flex justify-between items-center hover:bg-azul-dark transition-colors shadow-sm">
          <div>
            <p className="font-bold text-white text-lg flex items-center gap-2">
              <Icon name="chart" size={20} /> Mis Métricas
            </p>
            <p className="text-xs text-white/70 mt-0.5">Revisa tu conversión y comisiones</p>
          </div>
          <Icon name="arrow" size={22} className="text-white" />
        </Link>

        <form onSubmit={guardarAseguradora} className="lumo-card relative p-5 space-y-4">
          <span className="lumo-tape"></span>
          <h2 className="font-bold text-ink text-lg flex items-center gap-2">
            <Icon name="shield" size={18} className="text-azul" /> Agregar Aseguradora
          </h2>

          <select value={nombre} onChange={(e) => setNombre(e.target.value)} className="lumo-input">
            <option>AXA</option><option>MetLife</option><option>Profuturo</option><option>GNP</option><option>Seguros Monterrey</option><option>Mapfre</option><option>Qualitas</option>
          </select>
          <input type="url" placeholder="Enlace al portal (https://...)" value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} className="lumo-input" />
          <input type="text" placeholder="Tu usuario en el portal" value={usuario} onChange={(e) => setUsuario(e.target.value)} className="lumo-input" />
          <input type="text" placeholder="Nombre de tu ejecutivo de cuenta" value={ejecutivo} onChange={(e) => setEjecutivo(e.target.value)} className="lumo-input" />
          <input type="tel" placeholder="Teléfono de soporte / ejecutivo" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="lumo-input" />

          <button type="submit" className="w-full lumo-btn-primary py-3">Guardar</button>
        </form>

        <div>
          <h2 className="lumo-section-title mb-3">Mis Aseguradoras</h2>
          <div className="space-y-3">
            {aseguradoras.map((a) => (
              <div key={a.id} className="lumo-card p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-ink text-lg">{a.nombre}</p>
                    <div className="text-sm text-ink-soft mt-2 space-y-1">
                      <p>Usuario: <span className="text-ink font-semibold">{a.usuario || 'N/A'}</span></p>
                      <p>Ejecutivo: <span className="text-ink font-semibold">{a.ejecutivo || 'N/A'}</span></p>
                      <p>Teléfono: <span className="text-ink font-semibold">{a.telefono || 'N/A'}</span></p>
                    </div>
                  </div>
                  <button onClick={() => eliminarAseguradora(a.id)} className="text-ink-faint hover:text-rojo p-1 ml-2"><Icon name="trash" size={17} /></button>
                </div>

                {a.portal_url && (
                  <a href={a.portal_url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center w-full lumo-btn-ghost text-azul font-semibold py-2 text-sm">
                    Abrir Portal Oficial
                  </a>
                )}
              </div>
            ))}
            {aseguradoras.length === 0 && (
              <div className="lumo-card lumo-lines p-6 border-dashed text-center">
                <p className="font-hand text-xl text-ink-faint">no has registrado aseguradoras</p>
              </div>
            )}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
