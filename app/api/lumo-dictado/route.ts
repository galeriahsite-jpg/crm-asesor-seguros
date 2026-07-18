// ============================================================
// LUMO · Dictáfono inteligente (autenticado)
// Recibe audio → transcribe con Whisper → extrae datos de CRM.
//
// Blindaje aplicado (riesgo crítico 1 — era la ruta más expuesta):
// - Exige token Bearer de sesión Supabase.
// - Rate limit por asesor (20 dictados/hora).
// - Límites de audio: tamaño máx 10 MB, tipo MIME de audio,
//   un solo archivo.
// - Salida del modelo validada con Zod antes de devolverla.
// - Registro de consumo en ai_usage (best effort).
// ============================================================

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { autenticar, limitarUso, registrarUsoIA } from '../_lib/servidor';

const LIMITE_POR_ASESOR = 20;          // dictados por hora
const VENTANA_SEGUNDOS = 3600;
const AUDIO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIPOS_AUDIO = [
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/x-m4a', 'audio/m4a',
];

// La extracción del modelo, validada antes de confiar en ella.
const datosSchema = z.object({
  nombre: z.string().max(120).nullish().default(null),
  telefono: z.string().max(30).nullish().default(null),
  producto: z.string().max(60).nullish().default(null),
  nota: z.string().max(2000).nullish().default(null),
  proxima_accion: z.string().max(300).nullish().default(null),
  fecha_proxima: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().default(null),
});

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Servicio de IA no configurado.' }, { status: 500 });
  }

  // ── 1. Sesión del asesor (obligatoria) ──
  const auth = await autenticar(req);
  if (!auth.ok) return auth.respuesta;
  const { user } = auth;

  // ── 2. Rate limit por asesor ──
  const excedido = await limitarUso(
    `ia:dictado:user:${user.id}`,
    LIMITE_POR_ASESOR,
    VENTANA_SEGUNDOS,
    `Alcanzaste el límite de ${LIMITE_POR_ASESOR} dictados por hora.`
  );
  if (excedido) return excedido;

  // ── 3. Validación del audio ──
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const audioFile = formData.get('audio');
  if (!(audioFile instanceof File)) {
    return NextResponse.json({ error: 'No se recibió audio' }, { status: 400 });
  }
  if (audioFile.size === 0) {
    return NextResponse.json({ error: 'El audio está vacío.' }, { status: 400 });
  }
  if (audioFile.size > AUDIO_MAX_BYTES) {
    return NextResponse.json(
      { error: 'El audio es demasiado grande (máximo 10 MB). Graba una nota más corta.' },
      { status: 413 }
    );
  }
  const tipo = (audioFile.type || '').split(';')[0].trim().toLowerCase();
  if (tipo && !TIPOS_AUDIO.includes(tipo)) {
    return NextResponse.json({ error: 'Formato de audio no soportado.' }, { status: 415 });
  }

  // Timeout defensivo: Whisper + extracción no deben colgar la ruta.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 1 });
  const modelo = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const inicio = Date.now();

  try {
    // ── 4. Transcribir el audio con Whisper ──
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'es',
    });

    const texto = (transcription.text || '').trim().slice(0, 4000);
    if (!texto) {
      void registrarUsoIA({
        user_id: user.id, route: 'lumo-dictado', model: 'whisper-1',
        duration_ms: Date.now() - inicio, success: false,
      });
      return NextResponse.json(
        { error: 'No se entendió el audio. Intenta grabar de nuevo.' },
        { status: 422 }
      );
    }

    // ── 5. Extraer datos estructurados ──
    const hoy = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Mexico_City',
    });

    const completion = await openai.chat.completions.create({
      model: modelo,
      messages: [
        {
          role: 'system',
          content: `Eres LUMO, el asistente de un asesor de seguros en México. Tu trabajo es tomar una nota de voz y extraer los datos para el CRM. Hoy es ${hoy}.
          Devuelve ÚNICAMENTE un JSON con esta estructura:
          {
            "nombre": "string o null",
            "telefono": "string o null",
            "producto": "string o null",
            "nota": "string o null",
            "proxima_accion": "string o null",
            "fecha_proxima": "YYYY-MM-DD o null"
          }
          Si el usuario dice "el viernes", calcula la fecha real del próximo viernes.
          NUNCA inventes datos que el asesor no dijo: usa null.`,
        },
        { role: 'user', content: texto },
      ],
      response_format: { type: 'json_object' },
    });

    void registrarUsoIA({
      user_id: user.id,
      route: 'lumo-dictado',
      model: modelo,
      input_tokens: completion.usage?.prompt_tokens ?? null,
      output_tokens: completion.usage?.completion_tokens ?? null,
      duration_ms: Date.now() - inicio,
      success: true,
    });

    // ── 6. Validar la salida del modelo (Zod) ──
    let datosCrudos: unknown;
    try {
      datosCrudos = JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      datosCrudos = {};
    }
    const validado = datosSchema.safeParse(datosCrudos);
    const datos = validado.success
      ? validado.data
      : { nombre: null, telefono: null, producto: null, nota: texto, proxima_accion: null, fecha_proxima: null };

    // Devolvemos tanto el texto original como los datos estructurados
    return NextResponse.json({ texto, datos });
  } catch (error) {
    console.error('Error en LUMO dictado:', error);
    void registrarUsoIA({
      user_id: user.id, route: 'lumo-dictado', model: modelo,
      duration_ms: Date.now() - inicio, success: false,
    });
    return NextResponse.json(
      { error: 'Error al procesar el audio. Intenta de nuevo.' },
      { status: 502 }
    );
  }
}
