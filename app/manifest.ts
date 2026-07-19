import type { MetadataRoute } from 'next';

// LUMO como app instalable (PWA): icono en el home screen,
// pantalla completa sin barra de navegador, splash con la marca.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LUMO · CRM Asesor de Seguros',
    short_name: 'LUMO',
    description: 'Tu memoria operativa: prospectos, seguimiento y ventas.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D0D0D',
    theme_color: '#0D0D0D',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
