'use client';

import type { ReactElement } from 'react';
import { PdfLibProvider } from './primitives';

/** Renders a template to a real PDF (vector text). */
export async function renderPdf(element: ReactElement): Promise<Blob> {
  const lib = await import('@react-pdf/renderer');
  return lib.pdf(<PdfLibProvider value={lib}>{element}</PdfLibProvider> as never).toBlob();
}

export const safeFileName = (name: string) => name.replace(/[^\w\-. äöüÄÖÜß]+/g, '_');

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName(fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Renders a template to a PDF and triggers the download. */
export async function downloadPdf(element: ReactElement, fileName: string) {
  downloadBlob(await renderPdf(element), fileName);
}
