import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { SITE_URL } from '../lib/site';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Sora({ subsets: ['latin'], variable: '--font-display-face', display: 'swap', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'VYSNER One – Angebote, Rechnungen & Zahlen für kleine Unternehmen',
  description: 'Angebote und Rechnungen mit einmaligen und monatlichen Kosten, eigenes Design, Material und Lager, Ausgaben und GuV – im Browser und als App. Kostenlos starten.',
  keywords: ['Rechnungsprogramm', 'Angebote schreiben', 'Rechnungen schreiben', 'Handwerkersoftware', 'Lagerverwaltung', 'Kleinunternehmer', 'Österreich', 'Schweiz', 'DATEV'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'VYSNER One',
    title: 'VYSNER One – Angebote, Rechnungen & Zahlen für kleine Unternehmen',
    description: 'Angebote, Rechnungen mit monatlichen Kosten, Material, Ausgaben und GuV in einer Software – im Browser und als App.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#06100b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
