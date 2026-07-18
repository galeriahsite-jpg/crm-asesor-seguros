"use client";
// ============================================================
// LUMO · Sistema de notificaciones nativo (adiós alert/confirm)
//  - toast(mensaje, tipo): aviso discreto que se desvanece solo.
//  - confirmarLumo(mensaje|opciones): sheet inferior con estilo
//    LUMO que devuelve Promise<boolean>.
// Montar <NotificacionesLumo /> una sola vez en el layout.
// ============================================================
import { useEffect, useState } from 'react';
import { Icon } from './lumo';

type TipoToast = 'exito' | 'error' | 'info';
type Toast = { id: number; mensaje: string; tipo: TipoToast };
type OpcionesConfirmar = {
  titulo?: string;
  mensaje: string;
  textoAceptar?: string;
  textoCancelar?: string;
  peligro?: boolean;
};
type EstadoConfirmar = OpcionesConfirmar & { resolver: (ok: boolean) => void };

// ── Estado singleton (fuera de React para poder llamarse desde
//    cualquier función, igual que alert/confirm) ──
let toastsActuales: Toast[] = [];
let confirmarActual: EstadoConfirmar | null = null;
const suscriptores = new Set<() => void>();
function emitir() { suscriptores.forEach(fn => fn()); }

/** Aviso discreto. Por defecto 'error' (la mayoría de los avisos
 *  antiguos lo eran); marca 'exito' explícitamente en los logros. */
export function toast(mensaje: string, tipo: TipoToast = 'error') {
  const id = Date.now() + Math.random();
  toastsActuales = [...toastsActuales, { id, mensaje, tipo }];
  emitir();
  setTimeout(() => {
    toastsActuales = toastsActuales.filter(t => t.id !== id);
    emitir();
  }, tipo === 'error' ? 5000 : 3200);
}

/** Sheet de confirmación con estilo LUMO. */
export function confirmarLumo(opciones: string | OpcionesConfirmar): Promise<boolean> {
  const opts: OpcionesConfirmar =
    typeof opciones === 'string' ? { mensaje: opciones } : opciones;
  return new Promise<boolean>(resolver => {
    confirmarActual = { ...opts, resolver };
    emitir();
  });
}

export function NotificacionesLumo() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const refrescar = () => setTick(t => t + 1);
    suscriptores.add(refrescar);
    return () => { suscriptores.delete(refrescar); };
  }, []);

  function resolverConfirmar(ok: boolean) {
    confirmarActual?.resolver(ok);
    confirmarActual = null;
    emitir();
  }

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md space-y-2 pointer-events-none">
        {toastsActuales.map(t => (
          <div
            key={t.id}
            className={`lumo-card px-4 py-3 flex items-start gap-2.5 shadow-lg animate-[lumoToast_.25s_ease-out] pointer-events-auto ${
              t.tipo === 'error' ? 'border-l-4 border-l-rojo' :
              t.tipo === 'exito' ? 'border-l-4 border-l-verde' : 'border-l-4 border-l-azul'
            }`}
          >
            <span className={
              t.tipo === 'error' ? 'text-rojo' : t.tipo === 'exito' ? 'text-verde' : 'text-azul'
            }>
              <Icon name={t.tipo === 'error' ? 'alert' : t.tipo === 'exito' ? 'check' : 'hoy'} size={18} />
            </span>
            <p className="text-sm text-ink font-medium leading-snug whitespace-pre-line">{t.mensaje}</p>
          </div>
        ))}
      </div>

      {/* Sheet de confirmación */}
      {confirmarActual && (
        <div
          className="fixed inset-0 z-[99] flex items-end justify-center bg-ink/40 backdrop-blur-sm"
          onClick={() => resolverConfirmar(false)}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-3xl border-t border-x border-ink/10 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-[lumoSheet_.25s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-ink/15 rounded-full mx-auto mb-4"></div>
            {confirmarActual.titulo && (
              <h3 className="text-lg font-bold text-ink mb-1">{confirmarActual.titulo}</h3>
            )}
            <p className="text-sm text-ink-soft whitespace-pre-line">{confirmarActual.mensaje}</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => resolverConfirmar(false)}
                className="flex-1 lumo-btn-ghost py-3"
              >
                {confirmarActual.textoCancelar || 'Cancelar'}
              </button>
              <button
                onClick={() => resolverConfirmar(true)}
                className={`flex-1 py-3 ${confirmarActual.peligro ? 'lumo-btn-danger' : 'lumo-btn-primary'}`}
              >
                {confirmarActual.textoAceptar || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Evento global: las páginas escuchan para refrescar sus listas
 *  sin recargar la página (adiós window.location.reload). */
export function avisarDatosActualizados() {
  window.dispatchEvent(new CustomEvent('lumo:datos-actualizados'));
}
