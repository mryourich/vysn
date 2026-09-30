'use client';

import type { ReactElement } from 'react';
import { PdfLibProvider } from './primitives';

/** Renders a template to a real PDF file (vector text) and triggers the download. */
export async function downloadPdf(element: ReactElement, fileName: string) {
  const lib = await import('@react-pdf/renderer');
  const blob = await lib.pdf(<PdfLibProvider value={lib}>{element}</PdfLibProvider> as never).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.replace(/[^\w\-. äöüÄÖÜß]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
