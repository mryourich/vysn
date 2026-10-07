'use client';

import { Suspense } from 'react';
import { DocEditor } from '../../../../components/app/doc-editor';

export default function Page() {
  return <Suspense fallback={null}><DocEditor /></Suspense>;
}
