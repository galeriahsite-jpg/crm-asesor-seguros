// ============================================================
// LUMO · Validación y normalización de teléfonos MX / US
// Regla ÚNICA para todo el sistema (landings, CRM, API, IA).
//
// Niveles de validación aplicados:
//  1. Estructural por país:
//     · MX: 10 dígitos (acepta prefijos 52/521 pegados) y el
//       primer dígito debe ser 2-9 (ninguna LADA empieza con 0/1).
//     · US: 10 dígitos (acepta prefijo 1 pegado) y, por el plan
//       NANP, código de área y central empiezan con 2-9.
//  2. Anti-basura: rechaza números obviamente falsos
//     (todos los dígitos iguales, secuencias 0123456789/1234567890).
//  3. El país se guarda en `telefono_pais` y decide el prefijo
//     de WhatsApp (52 o 1). El campo `telefono` siempre queda
//     en 10 dígitos limpios.
//  4. La verificación REAL (¿existe el número?) vive en
//     /api/verificar-telefono y se activa sola cuando existan
//     credenciales de proveedor (Twilio Lookup) en el entorno.
// ============================================================

export type PaisTelefono = 'MX' | 'US';

export const MENSAJE_TELEFONO_INVALIDO = 'Ingresa un número válido de 10 dígitos.';

export const CODIGO_PAIS: Record<PaisTelefono, string> = { MX: '52', US: '1' };

const SECUENCIAS_BASURA = ['0123456789', '1234567890', '0987654321', '9876543210'];

function esBasura(d: string): boolean {
  if (/^(\d)\1{9}$/.test(d)) return true;       // los 10 dígitos iguales
  if (SECUENCIAS_BASURA.includes(d)) return true;
  return false;
}

/**
 * Normaliza un teléfono a 10 dígitos según el país.
 * MX acepta: "8991700262", "+52 899 170 0262", "521..." (13 díg.)
 * US acepta: "9561234567", "+1 956 123 4567" (11 díg. con 1)
 * Devuelve null si no cumple la estructura del país o es basura.
 */
export function normalizarTelefono(entrada: string, pais: PaisTelefono = 'MX'): string | null {
  let d = (entrada || '').replace(/\D/g, '');

  if (pais === 'MX') {
    if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
    else if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  } else {
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  }

  if (d.length !== 10) return null;
  if (esBasura(d)) return null;

  if (pais === 'MX') {
    // Ninguna LADA mexicana empieza con 0 ni 1.
    if (d[0] === '0' || d[0] === '1') return null;
  } else {
    // NANP: área NXX y central NXX (N = 2-9).
    if (d[0] === '0' || d[0] === '1') return null;
    if (d[3] === '0' || d[3] === '1') return null;
  }

  return d;
}

/** Compatibilidad: normalización solo-México (usada por /api/leads). */
export function normalizarTelefonoMX(entrada: string): string | null {
  return normalizarTelefono(entrada, 'MX');
}

/**
 * Validación para formularios donde el teléfono es OPCIONAL.
 * - Vacío → ok, telefono null.
 * - Con contenido → debe cumplir la estructura del país o error.
 */
export function validarTelefonoOpcional(entrada: string, pais: PaisTelefono = 'MX'):
  | { ok: true; telefono: string | null }
  | { ok: false; error: string } {
  const limpio = (entrada || '').trim();
  if (!limpio) return { ok: true, telefono: null };
  const normalizado = normalizarTelefono(limpio, pais);
  if (!normalizado) return { ok: false, error: MENSAJE_TELEFONO_INVALIDO };
  return { ok: true, telefono: normalizado };
}

/** Enlace de WhatsApp correcto según el país (52 para MX, 1 para US). */
export function enlaceWhatsApp(telefono: string, pais?: string | null, texto?: string): string {
  const d = (telefono || '').replace(/\D/g, '');
  const p: PaisTelefono = pais === 'US' ? 'US' : 'MX';
  const completo = d.length === 10 ? CODIGO_PAIS[p] + d : d;
  const query = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return `https://wa.me/${completo}${query}`;
}

/**
 * Verificación REAL del número (nivel 4) — llama a la API interna.
 * Devuelve:
 *  · true  → el proveedor confirmó que el número es válido
 *  · false → el proveedor confirmó que NO es válido
 *  · null  → sin proveedor configurado o error: no se pudo verificar
 * Nunca lanza: la verificación jamás bloquea el flujo por sí sola.
 */
export async function verificarTelefonoReal(
  telefono: string,
  pais: PaisTelefono,
  accessToken: string
): Promise<boolean | null> {
  try {
    const res = await fetch('/api/verificar-telefono', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ telefono, pais }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.valido === 'boolean' ? data.valido : null;
  } catch {
    return null;
  }
}
