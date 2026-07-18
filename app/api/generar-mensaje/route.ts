// ============================================================
// LUMO · Generación de primer contacto (autenticada)
//
// - La ruta NO es pública: exige sesión activa de Supabase
//   (token Bearer del asesor).
// - El navegador envía ÚNICAMENTE { prospectoId }. El nombre y
//   el interés se leen de la base con el token del asesor, así
//   RLS garantiza que el prospecto le pertenece.
// - Límite de uso por asesor (30 mensajes/hora).
// - Validación con Zod del cuerpo, y de la respuesta del modelo
//   (vacía o desbordada se rechaza).
// - Usa la Responses API de OpenAI.
// - Registro de consumo en ai_usage (best effort).
// ============================================================

import { z } from 'zod';
import { autenticar, limitarUso, registrarUsoIA } from '../_lib/servidor';

const LIMITE_POR_ASESOR = 30;      // mensajes por hora
const VENTANA_SEGUNDOS = 3600;
const MAX_SALIDA_CARACTERES = 700; // control de tamaño de salida

const cuerpoSchema = z.object({
  prospectoId: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : ''),
    z.uuid({ error: 'prospectoId inválido.' })
  ),
});

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
  const auth = await autenticar(request);
  if (!auth.ok) return auth.respuesta;
  const { user, supabaseUsuario } = auth;

  // ── 2. Cuerpo: solo { prospectoId } (Zod) ──
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  const validado = cuerpoSchema.safeParse(crudo);
  if (!validado.success) {
    return Response.json(
      { error: validado.error.issues[0]?.message || 'prospectoId inválido.' },
      { status: 400 }
    );
  }
  const { prospectoId } = validado.data;

  // ── 3. Límite por asesor ──
  const excedido = await limitarUso(
    `ia:user:${user.id}`,
    LIMITE_POR_ASESOR,
    VENTANA_SEGUNDOS,
    `Alcanzaste el límite de ${LIMITE_POR_ASESOR} mensajes por hora.`
  );
  if (excedido) return excedido;

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
  const modelo = process.env.LUMO_MODEL || 'gpt-4o-mini';
  const inicio = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(30000), // timeout defensivo
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        max_output_tokens: 300,
        instructions: PROMPT_SISTEMA,
        input: `Nombre de la persona: ${nombre}\nInterés indicado: ${interes}`,
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      console.error('generar-mensaje: OpenAI error', res.status, detalle);
      void registrarUsoIA({
        user_id: user.id, route: 'generar-mensaje', model: modelo,
        duration_ms: Date.now() - inicio, success: false,
      });
      return Response.json({ error: 'El modelo no respondió. Intenta de nuevo.' }, { status: 502 });
    }

    const data = await res.json();

    void registrarUsoIA({
      user_id: user.id,
      route: 'generar-mensaje',
      model: modelo,
      input_tokens: data?.usage?.input_tokens ?? null,
      output_tokens: data?.usage?.output_tokens ?? null,
      duration_ms: Date.now() - inicio,
      success: true,
    });

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
    void registrarUsoIA({
      user_id: user.id, route: 'generar-mensaje', model: modelo,
      duration_ms: Date.now() - inicio, success: false,
    });
    return Response.json({ error: 'Error de conexión con el modelo.' }, { status: 502 });
  }
}
