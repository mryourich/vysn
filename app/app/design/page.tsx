'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Das Rechnungsdesign ist jetzt der Bereich „Dokumentenlayout“ der Einstellungen. */
export default function DesignRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/einstellungen?bereich=layout'); }, [router]);
  return null;
}
