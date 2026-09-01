import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://springgreen-cormorant-809283.hostingersite.com'),
  title: 'VYSN — Dein Unternehmen. Ein System.',
  description: 'VYSN verbindet Aufträge, Kunden, Finanzen und Teamarbeit in einer modernen Unternehmensplattform.',
  openGraph: {
    title: 'VYSN — Dein Unternehmen. Ein System.',
    description: 'Die skalierbare Arbeitsplattform für moderne Unternehmen.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VYSN — Dein Unternehmen. Ein System.',
    description: 'Die skalierbare Arbeitsplattform für moderne Unternehmen.',
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
