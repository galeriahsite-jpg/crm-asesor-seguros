import LandingLead from '../components/LandingLead';

export const metadata = {
  title: 'Recomienda a un conocido',
  description: 'Ayuda a alguien que quieres a protegerse. Un asesor certificado lo orientará sin costo ni compromiso.',
};

export default function Referidos() {
  return (
    <LandingLead
      config={{
        icono: 'heart',
        kicker: 'proteger también es recomendar',
        titulo: 'Recomienda a alguien que quieras proteger',
        subtitulo: 'Comparte los datos de tu conocido y un asesor certificado lo orientará sin costo ni compromiso.',
        interes: 'Referido',
        etiquetaNombre: 'Nombre de tu conocido',
        etiquetaTelefono: 'WhatsApp de tu conocido',
        textoBoton: 'Enviar recomendación',
        textoConsentimiento: 'y confirmo que mi conocido sabe que compartiré su contacto y acepta que un asesor le escriba por WhatsApp.',
        textoExito: 'Gracias por tu confianza. Un asesor contactará a tu conocido con todo el cuidado que merece.',
        campos: [
          { clave: 'referidor', etiqueta: 'Tu nombre (quien recomienda)', placeholder: 'Nombre y apellido' },
          { clave: 'seguro', etiqueta: '¿Qué seguro le podría interesar?', opciones: ['Vida', 'Gastos Médicos', 'Auto', 'Hogar', 'Retiro', 'No estoy seguro'] },
        ],
        bullets: [
          ['Con respeto', 'Un solo contacto inicial, sin insistencia ni spam.'],
          ['Atención personal', 'Lo atiende un asesor real, no un call center.'],
          ['Sin costo', 'La orientación no cuesta nada y no hay compromiso de compra.'],
        ],
      }}
    />
  );
}
