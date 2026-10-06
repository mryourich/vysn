'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Das Rechnungsdesign ist jetzt ein Tab unter „Unternehmen“. */
export default function DesignRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/firma?tab=design'); }, [router]);
  return null;
}
