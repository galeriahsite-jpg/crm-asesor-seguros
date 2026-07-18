import LandingLead from '../../components/LandingLead';

export const metadata = {
  title: 'Protege a tu familia · Vida y Gastos Médicos',
  description: 'Recibe un diagnóstico de protección personalizado con un asesor certificado, sin costo.',
};

export default function CotizarVida() {
  return (
    <LandingLead
      config={{
        icono: 'heart',
        kicker: 'los que amas, protegidos',
        titulo: 'Protege a tu familia hoy',
        subtitulo: 'Seguro de vida o gastos médicos a tu medida. Un asesor certificado te arma un diagnóstico sin costo.',
        interes: 'Vida',
        opcionesInteres: ['Vida', 'Gastos Médicos'],
        etiquetaInteres: '¿Qué protección buscas?',
        textoBoton: 'Quiero mi diagnóstico',
        campos: [
          { clave: 'edad', etiqueta: 'Tu edad', tipo: 'number', placeholder: 'Ej. 35' },
          { clave: 'fumador', etiqueta: '¿Fumas?', opciones: ['No', 'Sí'] },
          { clave: 'dependientes', etiqueta: '¿Quién depende de ti?', opciones: ['Pareja e hijos', 'Solo hijos', 'Solo pareja', 'Mis padres', 'Nadie aún'] },
        ],
        bullets: [
          ['Diagnóstico honesto', 'Te decimos cuánta protección necesitas realmente, sin sobrevender.'],
          ['Varias aseguradoras', 'Comparamos GNP, MetLife, AXA y más, explicado en simple.'],
          ['Sin presión', 'Tú decides los tiempos. Nosotros te orientamos.'],
        ],
      }}
    />
  );
}
