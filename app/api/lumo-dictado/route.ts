import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No se recibió audio' }, { status: 400 });
    }

    // 1. Transcribir el audio con Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const texto = transcription.text;

    // 2. Extraer datos estructurados con GPT-4o
    const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: "system",
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
          Si el usuario dice "el viernes", calcula la fecha real del próximo viernes.`
        },
        { role: "user", content: texto }
      ],
      response_format: { type: "json_object" },
    });

    const datos = JSON.parse(completion.choices[0].message.content || '{}');

    // Devolvemos tanto el texto original como los datos estructurados
    return NextResponse.json({ texto, datos });

  } catch (error) {
    console.error('Error en LUMO dictado:', error);
    return NextResponse.json({ error: 'Error al procesar el audio' }, { status: 500 });
  }
}
