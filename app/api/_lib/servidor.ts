// ============================================================
// LUMO · Utilidades compartidas de las rutas de API
// - Configuración desde variables de entorno (sin hardcodes).
// - Autenticación por token Bearer de Supabase.
// - Rate limiting atómico (RPC incrementar_rate_limit).
// - Registro de consumo de IA en ai_usage (best effort).
// ============================================================

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.'
    );
  }
  return { url, anonKey, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

/** Cliente admin (service role). Null si no hay service key configurada. */
export function clienteAdmin(): SupabaseClient | null {
  const { url, serviceKey } = configSupabase();
  if (!serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Exige sesión de Supabase vía header Authorization: Bearer <token>.
 * Devuelve el usuario y un cliente que opera BAJO SU RLS, o un error listo
 * para responder.
 */
export async function autenticar(request: Request): Promise<
  | { ok: true; user: User; supabaseUsuario: SupabaseClient }
  | { ok: false; respuesta: Response }
> {
  const { url, anonKey } = configSupabase();

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return {
      ok: false,
      respuesta: Response.json({ error: 'Sesión requerida.' }, { status: 401 }),
    };
  }

  const supabaseUsuario = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabaseUsuario.auth.getUser(token);
  if (error || !user) {
    return {
      ok: false,
      respuesta: Response.json({ error: 'Sesión inválida o expirada.' }, { status: 401 }),
    };
  }

  return { ok: true, user, supabaseUsuario };
}

/**
 * Rate limit por clave con ventana deslizante.
 * Devuelve null si está dentro del límite; una Response 429 si lo excede.
 * Si no hay service key o el RPC falla, registra y deja pasar (el costo de
 * bloquear al asesor legítimo es mayor; el endpoint ya exige sesión).
 */
export async function limitarUso(
  clave: string,
  limite: number,
  ventanaSegundos: number,
  mensaje: string
): Promise<Response | null> {
  const admin = clienteAdmin();
  if (!admin) {
    console.warn(`rate-limit: SUPABASE_SERVICE_ROLE_KEY ausente, sin límite para ${clave}`);
    return null;
  }
  const { data: usos, error } = await admin.rpc('incrementar_rate_limit', {
    p_clave: clave,
    p_ventana_segundos: ventanaSegundos,
  });
  if (error) {
    console.error(`rate-limit: RPC no disponible para ${clave}`, error);
    return null;
  }
  if ((usos as number) > limite) {
    return Response.json({ error: mensaje }, { status: 429 });
  }
  return null;
}

/** Registro best-effort de consumo de IA. Nunca bloquea la respuesta. */
export async function registrarUsoIA(registro: {
  user_id: string | null;
  route: string;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  duration_ms?: number | null;
  success: boolean;
}): Promise<void> {
  try {
    const admin = clienteAdmin();
    if (!admin) return;
    const { error } = await admin.from('ai_usage').insert([registro]);
    if (error) console.error('ai_usage: no se pudo registrar', error);
  } catch (e) {
    console.error('ai_usage: error inesperado', e);
  }
}
