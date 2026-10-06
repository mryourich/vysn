/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Version des Builds – der Service Worker lädt bei einer neuen Version alles neu
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || String(Date.now()),
    // Nur für automatisierte Tests (Realtime-Ereignisse einspeisen) – im normalen Build leer
    NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E || '',
  },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
  async redirects() {
    return [
      { source: '/portal', destination: '/app', permanent: true },
      { source: '/preise', destination: '/#preise', permanent: true },
      { source: '/produkt', destination: '/#funktionen', permanent: true },
      { source: '/loesungen', destination: '/#funktionen', permanent: true },
      { source: '/kontakt', destination: '/#kontakt', permanent: true },
      { source: '/sicherheit', destination: '/#faq', permanent: true },
    ];
  },
};

module.exports = nextConfig;
