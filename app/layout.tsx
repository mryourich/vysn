import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://springgreen-cormorant-809283.hostingersite.com'),
  title: 'VYSN One — Weniger verwalten. Mehr unternehmen.',
  description: 'VYSN One verbindet Aufträge, Material, Kunden, Angebote, Rechnungen und Finanzen für kleine Unternehmen.',
  openGraph: {
    title: 'VYSN One — Die Unternehmenssoftware für kleine Betriebe',
    description: 'Aufträge, Material, Kunden, Dokumente und Finanzen in einem übersichtlichen System.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VYSN One — Die Unternehmenssoftware für kleine Betriebe',
    description: 'Aufträge, Material, Kunden, Dokumente und Finanzen in einem übersichtlichen System.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={inter.variable}
      >
        {children}
      </body>
    </html>
  );
}
