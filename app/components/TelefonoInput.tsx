"use client";
// ============================================================
// LUMO · Input de teléfono con poka-yoke
// Previene el error en origen (no lo corrige después):
//  - Solo permite dígitos (las letras ni se escriben).
//  - Teclado numérico en el celular (inputMode).
//  - Si pegan un número con prefijo +52 / 521, lo quita EN VIVO
//    (nunca trunca a ciegas: "+52 899..." jamás se corrompe).
//  - Tope de 10 dígitos con indicador visual 10/10 ✓.
// La validación al enviar (app/lib/telefono.ts) se mantiene como
// segunda capa: el poka-yoke es UX, no seguridad.
// ============================================================

export default function TelefonoInput({
  value,
  onChange,
  placeholder = '10 dígitos',
  className = 'lumo-input',
  required = false,
  mostrarContador = true,
}: {
  value: string;
  onChange: (telefono: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  mostrarContador?: boolean;
}) {
  function manejarCambio(entrada: string) {
    // 1. Solo dígitos (bloquea letras, espacios y símbolos al teclear).
    let d = entrada.replace(/\D/g, '');
    // 2. Prefijos de México pegados: se retiran en vivo, sin corromper.
    //    (Solo cuando hay MÁS de 10 dígitos: un número local que
    //     empiece con 52 y tenga 10 dígitos no se toca.)
    if (d.length > 10 && d.startsWith('521')) d = d.slice(3);
    else if (d.length > 10 && d.startsWith('52')) d = d.slice(2);
    // 3. Tope duro en 10.
    d = d.slice(0, 10);
    onChange(d);
  }

  const completo = value.length === 10;

  return (
    <div className="relative">
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
        className={`${className} ${mostrarContador ? 'pr-16' : ''}`}
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
  );
}
