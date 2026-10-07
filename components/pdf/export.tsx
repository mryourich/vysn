'use client';

import type { ReactElement } from 'react';
import { PdfLibProvider } from './primitives';

let fontsRegistered = false;

/**
 * Schriften fest ins PDF einbetten (Liberation, SIL OFL – metrisch gleich Helvetica/Times/Courier).
 * Nicht eingebettete Standardschriften ersetzen manche PDF-Betrachter (v. a. am Handy) durch
 * größere Schriften – dann überlappen Zeilen und Positionen.
 */
function registerFonts(lib: typeof import('@react-pdf/renderer')) {
  if (fontsRegistered) return;
  fontsRegistered = true;
  for (const [family, file] of [['VysnSans', 'Sans'], ['VysnSerif', 'Serif'], ['VysnMono', 'Mono']]) {
    lib.Font.register({
      family,
      fonts: [
        { src: `/fonts/pdf/Liberation${file}-Regular.ttf` },
        { src: `/fonts/pdf/Liberation${file}-Bold.ttf`, fontWeight: 'bold' },
      ],
    });
  }
}

/** Renders a template to a real PDF (vector text). */
export async function renderPdf(element: ReactElement): Promise<Blob> {
  const lib = await import('@react-pdf/renderer');
  registerFonts(lib);
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
