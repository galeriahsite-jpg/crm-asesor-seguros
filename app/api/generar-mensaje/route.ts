// ============================================================
// LUMO · Generación de primer contacto (autenticada)
//
// Correcciones aplicadas (puntos 5–8 de la revisión):
// - La ruta NO es pública: exige sesión activa de Supabase
//   (token Bearer del asesor).
// - El navegador envía ÚNICAMENTE { prospectoId }. El nombre y
//   el interés se leen de la base con el token del asesor, así
//   RLS garantiza que el prospecto le pertenece. Nadie puede
//   generar mensajes con datos falsificados ni de prospectos
//   ajenos.
// - Límite de uso por asesor (30 mensajes/hora).
// - Validación de prospectoId (UUID), del cuerpo JSON y de la
//   respuesta del modelo (vacía o desbordada se rechaza).
// - Usa la Responses API de OpenAI (interfaz principal actual).
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kbvbwuzhtsddqqacdfdb.supabase.co';
// Clave pública (la misma del navegador); los permisos reales los da RLS + token.
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_KczKDg4rZwj7t2fYzRX7jQ_rdFUsV-_';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIMITE_POR_ASESOR = 30;      // mensajes por hora
const VENTANA_SEGUNDOS = 3600;
const MAX_SALIDA_CARACTERES = 700; // control de tamaño de salida

const PROMPT_SISTEMA = `Eres LUMO, un asistente de comunicación para un asesor de seguros en México.
Redacta un único mensaje de primer contacto para WhatsApp.

Reglas:
- Español natural de México.
- Usa el primer nombre de la persona.
- Entre 45 y 80 palabras.
- Máximo dos párrafos.
- Tono profesional, cercano y humano.
- Explica que recibimos su solicitud sobre el interés indicado.
- Haz una sola invitación a conversar por WhatsApp o en una llamada breve.
- No uses presión ni urgencia artificial.
- No inventes precios, coberturas, rendimientos o condiciones.
- No afirmes que una solicitud será aprobada.
- No presentes a LUMO como una aseguradora.
- No uses "Estimado cliente".
- No agregues encabezados, comillas ni explicaciones.
- Devuelve únicamente el mensaje listo para revisión.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Servicio de IA no configurado.' }, { status: 500 });
  }

  // ── 1. Sesión del asesor (obligatoria) ──
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return Response.json({ error: 'Sesión requerida.' }, { status: 401 });
  }

  // Cliente con el token del asesor: todas las consultas pasan por RLS.
  const supabaseUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: errUser } = await supabaseUsuario.auth.getUser(token);
  if (errUser || !user) {
    return Response.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  // ── 2. Cuerpo: solo { prospectoId } ──
  let body: { prospectoId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  const prospectoId = (body.prospectoId || '').trim();
  if (!UUID_RE.test(prospectoId)) {
    return Response.json({ error: 'prospectoId inválido.' }, { status: 400 });
  }

  // ── 3. Límite por asesor (si hay service key; si no, se omite con aviso) ──
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
    const { data: usos, error: errRl } = await admin.rpc('incrementar_rate_limit', {
      p_clave: `ia:user:${user.id}`,
      p_ventana_segundos: VENTANA_SEGUNDOS,
    });
    if (!errRl && (usos as number) > LIMITE_POR_ASESOR) {
      return Response.json(
        { error: `Alcanzaste el límite de ${LIMITE_POR_ASESOR} mensajes por hora.` },
        { status: 429 }
      );
    }
    if (errRl) console.error('generar-mensaje: rate limit no disponible', errRl);
  } else {
    console.warn('generar-mensaje: SUPABASE_SERVICE_ROLE_KEY ausente, sin límite por asesor');
  }

  // ── 4. Leer el prospecto REAL con el token del asesor (RLS) ──
  const { data: prospecto, error: errProspecto } = await supabaseUsuario
    .from('prospectos')
    .select('id, nombre, producto')
    .eq('id', prospectoId)
    .single();

  if (errProspecto || !prospecto) {
    // No existe o no pertenece a este asesor: misma respuesta.
    return Response.json({ error: 'Prospecto no encontrado.' }, { status: 404 });
  }

  const nombre = (prospecto.nombre || '').trim().slice(0, 80);
  const interes = (prospecto.producto || '').trim().slice(0, 40) || 'su seguro';
  if (!nombre) {
    return Response.json({ error: 'El prospecto no tiene nombre registrado.' }, { status: 422 });
  }

  // ── 5. Generar con la Responses API ──
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.LUMO_MODEL || 'gpt-4o-mini',
        max_output_tokens: 300,
        instructions: PROMPT_SISTEMA,
        input: `Nombre de la persona: ${nombre}\nInterés indicado: ${interes}`,
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      console.error('generar-mensaje: OpenAI error', res.status, detalle);
      return Response.json({ error: 'El modelo no respondió. Intenta de nuevo.' }, { status: 502 });
    }

    const data = await res.json();

    // Responses API: texto en output_text (SDK) o en output[].content[].text (REST).
    let mensaje: string = typeof data.output_text === 'string' ? data.output_text : '';
    if (!mensaje && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item?.type === 'message' && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c?.text === 'string') mensaje += c.text;
          }
        }
      }
    }
    mensaje = mensaje.trim();

    // Validar salida: ni vacía ni desbordada.
    if (!mensaje) {
      return Response.json({ error: 'El modelo devolvió una respuesta vacía.' }, { status: 502 });
    }
    if (mensaje.length > MAX_SALIDA_CARACTERES) {
      mensaje = mensaje.slice(0, MAX_SALIDA_CARACTERES).trim();
    }

    // Borrador editable: el asesor siempre revisa antes de enviar.
    return Response.json({ mensaje });
  } catch (err) {
    console.error('generar-mensaje: error de conexión', err);
    return Response.json({ error: 'Error de conexión con el modelo.' }, { status: 502 });
  }
}
