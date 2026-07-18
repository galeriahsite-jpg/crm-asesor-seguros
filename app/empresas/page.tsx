import LandingLead from '../components/LandingLead';

export const metadata = {
  title: 'Protección para tu empresa y tu equipo',
  description: 'Beneficios para empleados: gastos médicos, vida grupo, flotillas y retiro. Propuesta sin costo.',
};

export default function Empresas() {
  return (
    <LandingLead
      config={{
        icono: 'chart',
        kicker: 'equipos protegidos, empresas fuertes',
        titulo: 'Protección para tu empresa y tu equipo',
        subtitulo: 'Gastos médicos colectivos, vida grupo, flotillas y planes de retiro para empleados. Recibe una propuesta a la medida, sin costo.',
        interes: 'Empresas',
        etiquetaNombre: 'Nombre del contacto',
        etiquetaTelefono: 'WhatsApp de contacto',
        textoBoton: 'Solicitar propuesta',
        textoExito: 'Recibimos tu solicitud. Un asesor te contactará para preparar la propuesta de tu empresa.',
        campos: [
          { clave: 'empresa', etiqueta: 'Nombre de la empresa', placeholder: 'Razón social o nombre comercial' },
          { clave: 'puesto', etiqueta: 'Tu puesto', placeholder: 'Ej. RH, Dirección, Administración' },
          { clave: 'empleados', etiqueta: 'Número de empleados', opciones: ['1 a 10', '11 a 50', '51 a 200', 'Más de 200'] },
          { clave: 'beneficio', etiqueta: '¿Qué protección les interesa?', opciones: ['Gastos Médicos colectivo', 'Vida grupo', 'Autos / flotilla', 'Retiro para empleados', 'Varias / no estoy seguro'] },
        ],
        bullets: [
          ['Propuesta comparada', 'Cotizamos con varias aseguradoras y te presentamos opciones claras por empleado.'],
          ['Beneficio deducible', 'Los beneficios para empleados suelen ser deducibles y mejoran la retención de talento.'],
          ['Acompañamiento', 'Te ayudamos con la implementación y las dudas de tu equipo, sin costo extra.'],
        ],
      }}
    />
  );
}
