// ============================================================
// LUMO · Línea de tiempo universal — helper de registro
// Todo evento del ciclo comercial pasa por aquí para quedar en
// la cronología de la persona (tabla `actividades`).
// Best effort: registrar nunca debe romper la acción principal.
// ============================================================
import { supabase } from '../../supabaseClient';

export type TipoActividad =
  | 'lead_recibido'
  | 'prospecto_creado'
  | 'cliente_creado'
  | 'proxima_accion_definida'
  | 'contacto_whatsapp'
  | 'contacto_llamada'
  | 'mensaje_generado'
  | 'resultado_contacto'
  | 'cita_creada'
  | 'cita_resultado'
  | 'diagnostico_creado'
  | 'oportunidad_creada'
  | 'cotizacion_agregada'
  | 'etapa_cambiada'
  | 'nota_registrada'
  | 'convertido'
  | 'poliza_registrada'
  | 'servicio_abierto'
  | 'tramite_creado'
  | 'renovacion_contactada'
  | 'secuencia_enviada';

export const ETIQUETAS_ACTIVIDAD: Record<TipoActividad, string> = {
  lead_recibido: 'Lead recibido',
  prospecto_creado: 'Prospecto creado',
  cliente_creado: 'Cliente creado',
  proxima_accion_definida: 'Próxima acción definida',
  contacto_whatsapp: 'WhatsApp abierto',
  contacto_llamada: 'Llamada',
  mensaje_generado: 'Mensaje LUMO generado',
  resultado_contacto: 'Resultado de contacto',
  cita_creada: 'Cita agendada',
  cita_resultado: 'Resultado de cita',
  diagnostico_creado: 'Diagnóstico',
  oportunidad_creada: 'Oportunidad',
  cotizacion_agregada: 'Cotización',
  etapa_cambiada: 'Cambio de etapa',
  nota_registrada: 'Nota',
  convertido: 'Convertido en cliente',
  poliza_registrada: 'Póliza registrada',
  servicio_abierto: 'Servicio abierto',
  tramite_creado: 'Trámite',
  renovacion_contactada: 'Renovación contactada',
  secuencia_enviada: 'Seguimiento enviado',
};

export type Actividad = {
  id: string;
  tipo: TipoActividad;
  descripcion: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Registra una actividad. Nunca lanza: si falla, solo lo loguea. */
export async function registrarActividad(params: {
  tipo: TipoActividad;
  descripcion?: string;
  prospecto_id?: string | null;
  cliente_id?: string | null;
  oportunidad_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('actividades').insert([{
      user_id: user.id,
      tipo: params.tipo,
      descripcion: params.descripcion || null,
      prospecto_id: params.prospecto_id || null,
      cliente_id: params.cliente_id || null,
      oportunidad_id: params.oportunidad_id || null,
      metadata: params.metadata || null,
    }]);
    if (error) console.error('actividades: no se pudo registrar', error);
  } catch (e) {
    console.error('actividades: error inesperado', e);
  }
}

/**
 * Sella el primer contacto de un prospecto (speed-to-lead).
 * Idempotente: solo escribe la primera vez (lo garantiza el RPC).
 */
export async function sellarPrimerContacto(
  prospectoId: string,
  canal: 'whatsapp' | 'llamada' | 'mensaje' | 'otro'
): Promise<void> {
  try {
    const { error } = await supabase.rpc('sellar_primer_contacto', {
      p_prospecto_id: prospectoId,
      p_canal: canal,
    });
    if (error) console.error('primer_contacto: no se pudo sellar', error);
  } catch (e) {
    console.error('primer_contacto: error inesperado', e);
  }
}

/** Minutos transcurridos desde una fecha ISO, en texto corto. */
export function tiempoTranscurrido(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
