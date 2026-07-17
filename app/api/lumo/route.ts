// ============================================================
// LUMO · Intérprete de operaciones
// Recibe texto libre del asesor y devuelve acciones estructuradas
// para que la app las ejecute con confirmación del asesor.
//
// Requiere la variable de entorno OPENAI_API_KEY (ya vive en Vercel).
// Modelo configurable con LUMO_MODEL (default: gpt-4o-mini).
// ============================================================

type Persona = { id: string; nombre: string; tipo: 'prospecto' | 'cliente' };

const TIPOS_ACCION = [
  'crear_prospecto',
  'crear_cliente',
  'crear_cita',
  'definir_proxima_accion',
  'crear_oportunidad',
  'crear_servicio',
  'cambiar_estado',
  'registrar_nota',
  'generar_mensaje',
] as const;

function promptSistema(hoy: string, personas: Persona[]) {
  const directorio = personas.length
    ? personas.map(p => `- ${p.nombre} (${p.tipo}, id: ${p.id})`).join('\n')
    : '(vacío)';

  return `Eres LUMO, la memoria operativa personal de un asesor de seguros en México.
Tu única tarea: leer lo que el asesor dictó o escribió y convertirlo en acciones concretas de CRM.
No eres un chatbot. No conversas. Devuelves acciones estructuradas.

HOY ES: ${hoy} (usa esta fecha para resolver expresiones como "mañana", "el lunes", "la próxima semana").

DIRECTORIO ACTUAL DEL ASESOR (para vincular acciones a personas existentes):
 ${directorio}

REGLAS:
1. Devuelve SOLO JSON válido con esta forma exacta:
{
  "resumen": "frase corta de lo que entendiste",
  "acciones": [
    {
      "tipo": "uno de: ${TIPOS_ACCION.join(', ')}",
      "explicacion": "por qué propones esta acción, citando lo que dijo el asesor",
      "persona_id": "id del directorio si la persona YA existe, si no null",
      "persona_nombre": "nombre de la persona",
      "datos": { }
    }
  ]
}
2. Campos de "datos" según tipo:
   - crear_prospecto: { "telefono"?, "producto"? (Vida|Gastos Médicos|Auto|Hogar|Retiro), "nota"? }
   - crear_cliente: { "telefono"? }
   - crear_cita: { "fecha": "YYYY-MM-DD", "hora": "HH:MM", "tipo": Llamada|Videollamada|Visita|Diagnóstico|Seguimiento|Servicio }
   - definir_proxima_accion: { "accion": "texto", "fecha": "YYYY-MM-DD" }
   - crear_oportunidad: { "producto", "aseguradora"?, "prima"? }
   - crear_servicio: { "tipo": Duda sobre póliza|Cambio de datos|Aclaración de pago|Siniestro|Otro, "descripcion" }
   - cambiar_estado: { "nuevo_estado": Nuevo|Contactado|Calificado|Sin respuesta|Perdido }
   - registrar_nota: { "nota": "texto de la nota" }
   - generar_mensaje: { "objetivo": "para qué es el mensaje", "mensaje": "borrador listo para enviar, tono cercano y profesional, máximo 3 frases, sin inventar datos" }
3. Si el asesor menciona a alguien que NO está en el directorio, propone primero crear_prospecto (o crear_cliente si ya le compró) y usa persona_id null en las demás acciones de esa persona.
4. Si menciona un compromiso con fecha ("quedé de escribirle el lunes"), propone definir_proxima_accion. Si menciona hora concreta, propone crear_cita.
5. Guarda el contexto valioso (fuente, familia, empresa, presupuesto, objeciones) como registrar_nota o en la nota del prospecto nuevo.
6. NUNCA inventes teléfonos, montos, fechas ni datos que el asesor no dijo. Si falta un dato, omite el campo.
7. Si la hora no se especifica para una cita, usa "09:00" y menciónalo en la explicación.
8. Si el texto no contiene ninguna acción de CRM, devuelve acciones: [] y explica en resumen.
9. Todo en español.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'Falta configurar OPENAI_API_KEY en las variables de entorno.' },
      { status: 500 }
    );
  }

  let body: { texto?: string; personas?: Persona[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const texto = (body.texto || '').trim();
  if (!texto) {
    return Response.json({ error: 'No hay texto que interpretar.' }, { status: 400 });
  }
  // Límite defensivo de contexto (privacidad y costo)
  const personas = (body.personas || []).slice(0, 300);

  const hoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City',
  }) + ' (' + new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }) + ')';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.LUMO_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: promptSistema(hoy, personas) },
          { role: 'user', content: texto },
        ],
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      console.error('OpenAI error:', res.status, detalle);
      return Response.json(
        { error: `OpenAI Error (${res.status}): ${detalle}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const contenido = data?.choices?.[0]?.message?.content;

    let parsed: { resumen?: string; acciones?: unknown[] };
    try {
      parsed = JSON.parse(contenido);
    } catch {
      return Response.json(
        { error: 'No pude estructurar la respuesta. Intenta redactarlo de otra forma.' },
        { status: 502 }
      );
    }

    // Filtrar acciones con tipo desconocido (defensa contra alucinación)
    const acciones = Array.isArray(parsed.acciones)
      ? parsed.acciones.filter((a): a is Record<string, unknown> =>
          !!a && typeof a === 'object' &&
          TIPOS_ACCION.includes((a as Record<string, unknown>).tipo as typeof TIPOS_ACCION[number])
        )
      : [];

    return Response.json({
      resumen: typeof parsed.resumen === 'string' ? parsed.resumen : '',
      acciones,
    });
  } catch (err) {
    console.error('LUMO route error:', err);
    return Response.json(
      { error: 'Error de conexión con el modelo.' },
      { status: 502 }
    );
  }
}