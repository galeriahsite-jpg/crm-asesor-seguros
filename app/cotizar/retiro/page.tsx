import LandingLead from '../../components/LandingLead';

export const metadata = {
  title: 'Plan de retiro · Empieza hoy',
  description: 'Descubre cuánto necesitas ahorrar para el retiro que quieres, con un asesor certificado y sin costo.',
};

export default function CotizarRetiro() {
  return (
    <LandingLead
      config={{
        icono: 'star',
        kicker: 'tu futuro se construye hoy',
        titulo: 'Tu plan de retiro, sin letras chiquitas',
        subtitulo: 'Descubre cuánto necesitas ahorrar hoy para retirarte como quieres. Diagnóstico con un asesor certificado, sin costo.',
        interes: 'Retiro',
        textoBoton: 'Quiero mi plan de retiro',
        campos: [
          { clave: 'edad', etiqueta: 'Tu edad', tipo: 'number', placeholder: 'Ej. 35' },
          { clave: 'afore', etiqueta: '¿Tienes Afore?', opciones: ['Sí', 'No', 'No estoy seguro'] },
          { clave: 'ahorro', etiqueta: '¿Cuánto podrías ahorrar al mes?', opciones: ['Menos de $1,000', '$1,000 a $3,000', '$3,000 a $5,000', 'Más de $5,000'] },
        ],
        bullets: [
          ['Números reales', 'Te mostramos cuánto acumularías y qué pensión tendrías, con y sin plan.'],
          ['Deducible de impuestos', 'Los planes personales de retiro pueden deducirse en tu declaración anual.'],
          ['Sin presión', 'Tú decides los tiempos. Nosotros te orientamos.'],
        ],
      }}
    />
  );
}
