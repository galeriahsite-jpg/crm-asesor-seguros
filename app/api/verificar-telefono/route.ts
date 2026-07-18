// ============================================================
// LUMO · Verificación REAL de teléfono (nivel 4) — conectable
//
// SIN credenciales configuradas: responde { valido: null,
// proveedor: 'ninguno' } y el CRM sigue funcionando igual
// (la verificación externa nunca es requisito).
//
// CON credenciales en el entorno, se activa sola:
//  · TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN → Twilio Lookup v2
//    (verificación previa bajo demanda; costo por consulta).
//  · WHATSAPP_API_TOKEN → reservado para WhatsApp Business
//    Platform. Nota: Meta no ofrece "checar existencia" de un
//    número arbitrario; con WhatsApp la confirmación real llega
//    como estatus de entrega al enviar el primer mensaje del
//    flujo autónomo. Esta ruta lo dejará documentado/listo.
//
// Seguridad: exige sesión del asesor (Bearer), valida con Zod
// y limita a 30 verificaciones/hora por asesor.
// ============================================================

import { z } from 'zod';
import { autenticar, limitarUso } from '../_lib/servidor';
import { CODIGO_PAIS, normalizarTelefono } from '../../lib/telefono';

const cuerpoSchema = z.object({
  telefono: z.string().min(10).max(20),
  pais: z.enum(['MX', 'US']).default('MX'),
});

export async function POST(request: Request) {
  // ── 1. Sesión del asesor ──
  const auth = await autenticar(request);
  if (!auth.ok) return auth.respuesta;
  const { user } = auth;

  // ── 2. Rate limit ──
  const excedido = await limitarUso(
    `verif:user:${user.id}`, 30, 3600,
    'Alcanzaste el límite de 30 verificaciones por hora.'
  );
  if (excedido) return excedido;

  // ── 3. Entrada ──
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  const validado = cuerpoSchema.safeParse(crudo);
  if (!validado.success) {
    return Response.json({ error: 'Entrada inválida.' }, { status: 400 });
  }
  const { telefono, pais } = validado.data;

  const normalizado = normalizarTelefono(telefono, pais);
  if (!normalizado) {
    // Ya falla la estructura: no hace falta gastar en el proveedor.
    return Response.json({ valido: false, proveedor: 'estructura' });
  }

  // ── 4. Proveedor: Twilio Lookup (se activa solo con credenciales) ──
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (sid && token) {
    try {
      const e164 = `+${CODIGO_PAIS[pais]}${normalizado}`;
      const res = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}`,
        {
          signal: AbortSignal.timeout(10000),
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        // Twilio Lookup v2: `valid: true|false`.
        return Response.json({
          valido: data.valid === true,
          proveedor: 'twilio',
        });
      }
      if (res.status === 404) {
        // Número no encontrado/no válido según Twilio.
        return Response.json({ valido: false, proveedor: 'twilio' });
      }
      console.error('verificar-telefono: Twilio respondió', res.status);
      return Response.json({ valido: null, proveedor: 'twilio_error' });
    } catch (e) {
      console.error('verificar-telefono: error con Twilio', e);
      return Response.json({ valido: null, proveedor: 'twilio_error' });
    }
  }

  // ── Sin proveedor configurado: no se verifica, no se bloquea ──
  return Response.json({ valido: null, proveedor: 'ninguno' });
}
