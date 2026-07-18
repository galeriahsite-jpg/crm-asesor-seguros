// ============================================================
// LUMO · Embudo Flash · Recepción de leads
//
// Seguridad aplicada (correcciones 2–11 de la revisión):
// - Service role SOLO en servidor (nunca en el navegador).
// - Validación completa con Zod (estandarización del blindaje).
// - Deduplicación atómica: índice único parcial + upsert
//   ON CONFLICT DO NOTHING (inmune a condiciones de carrera).
// - Rate limiting real por IP con ventana en Supabase,
//   además del honeypot.
// - LUMO_LEAD_OWNER_ID validado como UUID y verificado como
//   usuario existente.
// - Todos los errores de Supabase se comprueban.
// - Consentimiento versionado.
//
// Variables de entorno requeridas (Vercel → Settings → Env):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY  (secreta, solo servidor)
//   LUMO_LEAD_OWNER_ID         (uuid del asesor dueño de los leads)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { configSupabase } from '../_lib/servidor';
import { normalizarTelefonoMX } from '../../lib/telefono';

// Si cambias el texto del aviso de privacidad, actualiza esta versión.
const CONSENTIMIENTO_VERSION = '2026-07';

const INTERESES_VALIDOS = ['Vida', 'Gastos Médicos', 'Auto', 'Hogar', 'Retiro', 'Empresas', 'Referido'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Límite: 5 solicitudes por IP por hora; 100 globales por hora.
const LIMITE_IP = 5;
const LIMITE_GLOBAL = 100;
const VENTANA_SEGUNDOS = 3600;

// ── Detalles extra por landing (auto, retiro, empresas, etc.) ──
//    Se validan con límites estrictos y se serializan a texto
//    para guardarse en nota_entrada_web (sin cambiar el esquema).
const DETALLES_MAX_CAMPOS = 15;
const DETALLES_MAX_CLAVE = 40;
const DETALLES_MAX_VALOR = 200;

// normalizarTelefonoMX viene de app/lib/telefono.ts: regla ÚNICA
// compartida con todos los formularios del CRM.

function serializarDetalles(v: Record<string, unknown> | null | undefined): string | null {
  if (!v) return null;
  const entradas = Object.entries(v).slice(0, DETALLES_MAX_CAMPOS);
  const partes: string[] = [];
  for (const [clave, valor] of entradas) {
    const k = clave.trim().slice(0, DETALLES_MAX_CLAVE);
    if (!k) continue;
    let val: string;
    if (typeof valor === 'string') val = valor.trim().slice(0, DETALLES_MAX_VALOR);
    else if (typeof valor === 'number' || typeof valor === 'boolean') val = String(valor);
    else continue;
    if (!val) continue;
    partes.push(`${k}: ${val}`);
  }
  return partes.length ? partes.join(' | ') : null;
}

// ── Esquema Zod del lead (validación estandarizada) ──
const campoUtm = z.preprocess(
  v => (typeof v === 'string' ? v.trim().slice(0, 100) || null : null),
  z.string().nullable()
);

const leadSchema = z.object({
  // Honeypot: si el campo oculto viene lleno, es un bot.
  sitio_web: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : ''),
    z.literal('', { error: 'Solicitud no válida.' })
  ),
  nombre: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : ''),
    z.string()
      .min(2, 'Escribe tu nombre (2 a 80 caracteres).')
      .max(80, 'Escribe tu nombre (2 a 80 caracteres).')
  ),
  telefono: z.preprocess(
    v => (typeof v === 'string' ? normalizarTelefonoMX(v) : null),
    z.string({ error: 'Escribe un número de WhatsApp válido de 10 dígitos.' })
  ),
  interes: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : ''),
    z.enum(INTERESES_VALIDOS, { error: 'Selecciona el seguro que te interesa.' })
  ),
  consentimiento: z.literal(true, { error: 'Necesitamos tu autorización para contactarte.' }),
  utm_source: campoUtm.optional().default(null),
  utm_medium: campoUtm.optional().default(null),
  utm_campaign: campoUtm.optional().default(null),
  detalles: z.record(z.string(), z.unknown()).nullish().default(null),
});

export async function POST(request: Request) {
  // ── Configuración del servidor ──
  let SUPABASE_URL: string;
  let serviceKey: string | undefined;
  try {
    const cfg = configSupabase();
    SUPABASE_URL = cfg.url;
    serviceKey = cfg.serviceKey;
  } catch (e) {
    console.error('leads:', e);
    return Response.json({ error: 'Servicio no disponible.' }, { status: 500 });
  }

  const ownerId = process.env.LUMO_LEAD_OWNER_ID;

  if (!serviceKey) {
    console.error('leads: falta SUPABASE_SERVICE_ROLE_KEY');
    return Response.json({ error: 'Servicio no disponible.' }, { status: 500 });
  }
  if (!ownerId || !UUID_RE.test(ownerId)) {
    console.error('leads: LUMO_LEAD_OWNER_ID ausente o no es UUID válido');
    return Response.json({ error: 'Servicio no disponible.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Cuerpo JSON válido y acotado ──
  let body: unknown;
  try {
    const crudo = await request.text();
    if (crudo.length > 5000) {
      return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
    }
    body = JSON.parse(crudo);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch {
    return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  // ── Rate limiting por IP y global (servidor, atómico) ──
  const ip =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconocida';

  const { data: usosIp, error: errIp } = await supabaseAdmin.rpc('incrementar_rate_limit', {
    p_clave: `leads:ip:${ip}`,
    p_ventana_segundos: VENTANA_SEGUNDOS,
  });
  const { data: usosGlobal, error: errGlobal } = await supabaseAdmin.rpc('incrementar_rate_limit', {
    p_clave: 'leads:global',
    p_ventana_segundos: VENTANA_SEGUNDOS,
  });
  if (errIp || errGlobal) {
    // Si el limitador falla, registramos pero no dejamos pasar sin control.
    console.error('leads: error en rate limit', errIp || errGlobal);
    return Response.json({ error: 'Intenta de nuevo en unos minutos.' }, { status: 503 });
  }
  if ((usosIp as number) > LIMITE_IP || (usosGlobal as number) > LIMITE_GLOBAL) {
    return Response.json(
      { error: 'Recibimos varias solicitudes desde tu conexión. Intenta más tarde.' },
      { status: 429 }
    );
  }

  // ── Validación de campos (Zod) ──
  const validacion = leadSchema.safeParse(body);
  if (!validacion.success) {
    return Response.json(
      { error: validacion.error.issues[0]?.message || 'Datos inválidos.' },
      { status: 400 }
    );
  }
  const lead = validacion.data;
  const detallesTexto = serializarDetalles(lead.detalles);

  // ── Verificar que el dueño configurado sea un usuario real ──
  const { data: owner, error: errOwner } =
    await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (errOwner || !owner?.user) {
    console.error('leads: LUMO_LEAD_OWNER_ID no corresponde a un usuario activo', errOwner);
    return Response.json({ error: 'Servicio no disponible.' }, { status: 500 });
  }

  const ahora = new Date().toISOString();
  const notaWeb =
    `Solicitud web · interés: ${lead.interes} · ${ahora}` +
    (detallesTexto ? ` · ${detallesTexto}` : '');

  // ── Inserción atómica: ON CONFLICT DO NOTHING sobre el índice
  //    único (user_id, telefono_normalizado). Sin carrera posible. ──
  const { data: insertado, error: errInsert } = await supabaseAdmin
    .from('prospectos')
    .upsert(
      [{
        user_id: ownerId,
        nombre: lead.nombre,
        telefono: lead.telefono,
        telefono_normalizado: lead.telefono,
        producto: lead.interes,
        estado: 'Nuevo',
        fuente: 'landing',
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        consentimiento_contacto: true,
        consentimiento_contacto_fecha: ahora,
        consentimiento_version: CONSENTIMIENTO_VERSION,
        ultima_solicitud_web: ahora,
        nota_entrada_web: notaWeb,
        nota: notaWeb,
      }],
      { onConflict: 'user_id,telefono_normalizado', ignoreDuplicates: true }
    )
    .select('id');

  if (errInsert) {
    console.error('leads: error al insertar', errInsert);
    return Response.json(
      { error: 'No pudimos registrar tu solicitud. Intenta de nuevo.' },
      { status: 500 }
    );
  }

  // ── Línea de tiempo: lead recibido (best effort, no bloquea) ──
  if (insertado && insertado.length > 0) {
    const { error: errAct } = await supabaseAdmin.from('actividades').insert([{
      user_id: ownerId,
      prospecto_id: insertado[0].id,
      tipo: 'lead_recibido',
      descripcion: `Lead de landing · interés: ${lead.interes}` +
        (lead.utm_source ? ` · fuente: ${lead.utm_source}` : ''),
      metadata: {
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
      },
    }]);
    if (errAct) console.error('leads: no se pudo registrar actividad', errAct);
  }

  // ── Si ya existía (duplicado), actualizar SOLO campos seguros:
  //    no tocamos estado, notas del asesor ni etapa. ──
  if (!insertado || insertado.length === 0) {
    const { error: errUpdate } = await supabaseAdmin
      .from('prospectos')
      .update({
        ultima_solicitud_web: ahora,
        nota_entrada_web: notaWeb,
      })
      .eq('user_id', ownerId)
      .eq('telefono_normalizado', lead.telefono);

    if (errUpdate) {
      console.error('leads: error al actualizar duplicado', errUpdate);
      // El lead ya existe: para la persona la solicitud fue recibida.
    }

    // Línea de tiempo: nueva solicitud del mismo teléfono (best effort).
    const { data: existente } = await supabaseAdmin
      .from('prospectos').select('id')
      .eq('user_id', ownerId)
      .eq('telefono_normalizado', lead.telefono)
      .single();
    if (existente) {
      await supabaseAdmin.from('actividades').insert([{
        user_id: ownerId,
        prospecto_id: existente.id,
        tipo: 'lead_recibido',
        descripcion: `Nueva solicitud web del mismo teléfono · interés: ${lead.interes}`,
      }]);
    }
  }

  // Respuesta idéntica exista o no el registro (no filtrar información).
  return Response.json({ ok: true });
}
