'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Unternehmensdaten und Rechnungsdesign sind jetzt Bereiche der Einstellungen. */
export default function CompanyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const design = new URLSearchParams(window.location.search).get('tab') === 'design';
    router.replace(`/app/einstellungen?bereich=${design ? 'layout' : 'firma'}`);
  }, [router]);
  return null;
}
