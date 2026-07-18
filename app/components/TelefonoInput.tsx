"use client";
// ============================================================
// LUMO · Input de teléfono con poka-yoke y selector de país
// Pensado para frontera (Tamaulipas): México 🇲🇽 por defecto,
// Estados Unidos 🇺🇸 disponible. El país decide el prefijo del
// enlace de WhatsApp (52 o 1) y las reglas de validación.
//
// Poka-yoke:
//  - Solo dígitos (las letras ni se escriben).
//  - Teclado numérico en el celular (inputMode).
//  - Prefijos pegados (+52/521 en MX, +1 en US) se quitan EN
//    VIVO sin corromper el número.
//  - Tope de 10 dígitos con indicador 10/10 ✓.
// La validación al enviar (app/lib/telefono.ts) es la segunda capa.
// ============================================================
import type { PaisTelefono } from '../lib/telefono';

export default function TelefonoInput({
  value,
  onChange,
  pais = 'MX',
  onChangePais,
  placeholder = '10 dígitos',
  className = 'lumo-input',
  required = false,
  mostrarContador = true,
}: {
  value: string;
  onChange: (telefono: string) => void;
  pais?: PaisTelefono;
  onChangePais?: (pais: PaisTelefono) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  mostrarContador?: boolean;
}) {
  function manejarCambio(entrada: string) {
    // 1. Solo dígitos (bloquea letras, espacios y símbolos al teclear).
    let d = entrada.replace(/\D/g, '');
    // 2. Prefijos de país pegados: se retiran en vivo, sin corromper.
    //    (Solo cuando hay MÁS de 10 dígitos: un número local no se toca.)
    if (pais === 'MX') {
      if (d.length > 10 && d.startsWith('521')) d = d.slice(3);
      else if (d.length > 10 && d.startsWith('52')) d = d.slice(2);
    } else {
      if (d.length > 10 && d.startsWith('1')) d = d.slice(1);
    }
    // 3. Tope duro en 10.
    d = d.slice(0, 10);
    onChange(d);
  }

  const completo = value.length === 10;

  return (
    <div className="flex gap-2">
      {onChangePais && (
        <select
          value={pais}
          onChange={e => onChangePais(e.target.value as PaisTelefono)}
          aria-label="País del teléfono"
          className="lumo-input w-24 shrink-0 px-2"
        >
          <option value="MX">🇲🇽 +52</option>
          <option value="US">🇺🇸 +1</option>
        </select>
      )}
      <div className="relative flex-1">
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={value}
          onChange={e => manejarCambio(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={required ? 10 : undefined}
          maxLength={10}
          className={`${className} ${mostrarContador ? 'pr-16' : ''} w-full`}
        />
        {mostrarContador && value.length > 0 && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${
              completo ? 'text-verde' : 'text-ink-faint'
            }`}
          >
            {value.length}/10{completo ? ' ✓' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
