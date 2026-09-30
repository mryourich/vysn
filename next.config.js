/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
