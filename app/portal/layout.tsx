import type { Metadata } from 'next';
import './portal.css';

export const metadata: Metadata = {
  title: 'VYSN One — Plattform',
  description: 'Die zentrale Arbeitsplattform für Aufträge, Material, Kunden, Angebote, Rechnungen und Finanzen.',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
