import LandingLead from '../../components/LandingLead';

export const metadata = {
  title: 'Cotiza tu seguro de auto',
  description: 'Compara opciones de varias aseguradoras con un asesor certificado, sin costo.',
};

export default function CotizarAuto() {
  return (
    <LandingLead
      config={{
        icono: 'rocket',
        kicker: 'tu auto, protegido',
        titulo: 'Cotiza tu seguro de auto',
        subtitulo: 'Comparamos AXA, HDI, GNP y más aseguradoras por ti. Un asesor certificado te presenta las mejores opciones, sin costo.',
        interes: 'Auto',
        textoBoton: 'Cotizar mi auto',
        campos: [
          { clave: 'marca', etiqueta: 'Marca del auto', placeholder: 'Ej. Nissan, Toyota, VW' },
          { clave: 'modelo', etiqueta: 'Modelo', placeholder: 'Ej. Versa, Corolla, Jetta' },
          { clave: 'anio', etiqueta: 'Año', tipo: 'number', placeholder: 'Ej. 2022' },
          { clave: 'cp', etiqueta: 'Código postal donde circula', placeholder: '5 dígitos' },
        ],
        bullets: [
          ['Comparativa real', 'Cotizamos en varias aseguradoras y te explicamos las diferencias en simple.'],
          ['Atención personal', 'Te atiende un asesor real, no un call center.'],
          ['Sin presión', 'Tú decides los tiempos. Nosotros te orientamos.'],
        ],
      }}
    />
  );
}
