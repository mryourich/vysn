import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VYSNER One',
    short_name: 'VYSNER',
    description: 'Angebote, Rechnungen, Lager und Zahlen für kleine Unternehmen.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#06100b',
    theme_color: '#06100b',
    lang: 'de',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Lager-Scanner', short_name: 'Scanner', url: '/app/scan', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Neue Rechnung', short_name: 'Rechnungen', url: '/app/rechnungen' },
    ],
  };
}
