"use client";
import { useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function LumoDictado() {
  const [grabando, setGrabando] = useState(false);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [textoOriginal, setTextoOriginal] = useState('');
  const [datos, setDatos] = useState<any>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const empezarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'dictado.webm', { type: 'audio/webm' });
        
        setCargandoIA(true);
        
        // Enviar al cerebro de LUMO
        const formData = new FormData();
        formData.append('audio', audioFile);
        
        const res = await fetch('/api/lumo-dictado', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        if (data.error) {
          alert('Error: ' + data.error);
        } else {
          setTextoOriginal(data.texto);
          setDatos(data.datos);
        }
        setCargandoIA(false);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setGrabando(true);
    } catch (error) {
      alert('No se pudo acceder al micrófono. Revisa los permisos de tu navegador.');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setGrabando(false);
    }
  };

  const confirmarGuardado = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('prospectos').insert([{
      nombre: datos.nombre,
      telefono: datos.telefono,
      producto: datos.producto,
      nota: datos.nota,
      estado: 'Nuevo',
      proxima_accion: datos.proxima_accion,
      fecha_proxima: datos.fecha_proxima,
      user_id: user.id
    }]);

    if (error) {
      alert('Error al guardar en la base de datos');
    } else {
      alert('✅ Prospecto guardado y acción agendada por LUMO.');
      // Limpiar y recargar
      setDatos(null);
      setTextoOriginal('');
      window.location.reload(); // Recarga para ver el nuevo prospecto en la lista
    }
  };

  return (
    <>
      {/* Botón Flotante del Micrófono */}
      <button
        onClick={grabando ? detenerGrabacion : empezarGrabacion}
        disabled={cargandoIA}
        className={`fixed bottom-24 right-4 z-50 w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white transition-all ${grabando ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {cargandoIA ? '⏳' : grabando ? '⏹️' : '🎤'}
      </button>

      {/* Tarjeta de Confirmación (El Poka-Yoke) */}
      {datos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-black">LUMO entendió esto:</h3>
            
            <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600 italic">
              "{textoOriginal}"
            </div>

            <div className="space-y-2 text-black">
              {datos.nombre && <p><strong>Nombre:</strong> {datos.nombre}</p>}
              {datos.telefono && <p><strong>Teléfono:</strong> {datos.telefono}</p>}
              {datos.producto && <p><strong>Producto:</strong> {datos.producto}</p>}
              {datos.nota && <p><strong>Nota:</strong> {datos.nota}</p>}
              {datos.proxima_accion && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mt-2">
                  <p className="text-amber-800 font-bold text-sm">⚠️ Próxima Acción:</p>
                  <p className="text-amber-700">{datos.proxima_accion}</p>
                  {datos.fecha_proxima && <p className="text-amber-600 text-xs mt-1">📅 {datos.fecha_proxima}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => { setDatos(null); setTextoOriginal(''); }} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">
                Cancelar
              </button>
              <button onClick={confirmarGuardado} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}