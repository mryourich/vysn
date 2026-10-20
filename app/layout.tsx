import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Sora({ subsets: ['latin'], variable: '--font-display-face', display: 'swap', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://springgreen-cormorant-809283.hostingersite.com'),
  title: 'VYSNER One – Software für Elektriker & Handwerk in Österreich',
  description: 'Von der Baustelle direkt zur Rechnung: Regiestunden, Material, Fotos und Mängel am Handy erfassen, mit einem Klick abrechnen. Mit Lager, Angeboten und österreichischen Steuersätzen.',
  openGraph: {
    title: 'VYSNER One – Software für Elektriker & Handwerk in Österreich',
    description: 'Software für Elektriker und Handwerksbetriebe in Österreich: Baustellen, Regiestunden, Lager, Angebote und Rechnungen.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#06100b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-AT" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
