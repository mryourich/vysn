import type { Metadata } from 'next';
import { AppShell } from '../../components/app/shell';
import './app.css';

export const metadata: Metadata = {
  title: 'VYSN One – Arbeitsbereich',
  robots: { index: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
