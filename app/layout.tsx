import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://springgreen-cormorant-809283.hostingersite.com'),
  title: 'VYSN One – Angebote, Rechnungen & Zahlen für kleine Unternehmen',
  description: 'Angebote und Rechnungen im eigenen Design, Material und Lager, Ausgaben und GuV – übersichtlich in einer Software für KMU und Handwerk.',
  openGraph: {
    title: 'VYSN One – Angebote, Rechnungen & Zahlen für kleine Unternehmen',
    description: 'Angebote, Rechnungen, Material, Ausgaben und GuV in einer übersichtlichen Software.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f5f1' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
