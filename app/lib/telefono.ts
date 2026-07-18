// ============================================================
// LUMO · Validación y normalización de teléfonos MX
// Regla ÚNICA para todo el sistema (misma que /api/leads):
//   válido = 10 dígitos, o 12 con prefijo 52, o 13 con 521.
//   Cualquier otra cosa (9, 11 sin prefijo, letras) = inválido.
// Usada por: captura/edición de prospectos, alta/edición de
// clientes, LumoDictado, LumoCapture y la API de leads.
// ============================================================

export const MENSAJE_TELEFONO_INVALIDO = 'Ingresa un número válido de 10 dígitos.';

/**
 * Normaliza un teléfono mexicano a 10 dígitos.
 * Acepta: "8992220001", "899 222 0001", "899-222-0001",
 *         "+52 899 222 0001", "521 899 222 0001".
 * Devuelve null si no es un número MX válido (9 díg., 11 díg.
 * sin prefijo 52, letras insuficientes, incompleto, etc.).
 */
export function normalizarTelefonoMX(entrada: string): string | null {
  const digitos = (entrada || '').replace(/\D/g, '');
  if (digitos.length === 10) return digitos;
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos.slice(2);
  if (digitos.length === 13 && digitos.startsWith('521')) return digitos.slice(3);
  return null;
}

/**
 * Validación para formularios donde el teléfono es OPCIONAL
 * (captura manual: a veces conoces a alguien sin su número).
 * - Vacío → ok, telefono null.
 * - Con contenido → debe normalizar a 10 dígitos o es error.
 */
export function validarTelefonoOpcional(entrada: string):
  | { ok: true; telefono: string | null }
  | { ok: false; error: string } {
  const limpio = (entrada || '').trim();
  if (!limpio) return { ok: true, telefono: null };
  const normalizado = normalizarTelefonoMX(limpio);
  if (!normalizado) return { ok: false, error: MENSAJE_TELEFONO_INVALIDO };
  return { ok: true, telefono: normalizado };
}
