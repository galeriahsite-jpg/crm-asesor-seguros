// ============================================================
// LUMO · Fechas humanas: "2026-07-25" → "hoy" / "mañana" / "vie 25 jul"
// Solo presentación; nunca cambia lo guardado.
// ============================================================

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearFecha(iso?: string | null): string {
  if (!iso) return 'sin fecha';
  const soloFecha = iso.split('T')[0];
  const [a, m, d] = soloFecha.split('-').map(Number);
  if (!a || !m || !d) return iso;

  const fecha = new Date(a, m - 1, d);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);

  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';

  const base = `${DIAS[fecha.getDay()]} ${d} ${MESES[m - 1]}`;
  return fecha.getFullYear() !== hoy.getFullYear() ? `${base} ${a}` : base;
}
