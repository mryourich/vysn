'use client';

import QRCode from 'qrcode';

/** QR-Codes enthalten eine normale Web-Adresse: mit jeder Handykamera scanbar, öffnet direkt die Buchungsseite. */
export function scanUrl(target: { location?: string; material?: string }, companyId: string | null) {
  const params = new URLSearchParams();
  if (target.location) params.set('l', target.location);
  if (target.material) params.set('m', target.material);
  if (companyId) params.set('c', companyId);
  return `${window.location.origin}/app/scan?${params.toString()}`;
}

export function qrDataUrl(text: string, size = 360) {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1220', light: '#ffffff' } });
}

/** Liest l/m/c aus einem gescannten Text (URL) oder sucht einen Klartext-Code. */
export function parseScan(text: string): { location?: string; material?: string; company?: string; code?: string } {
  try {
    const url = new URL(text);
    if (url.pathname.endsWith('/app/scan')) {
      return { location: url.searchParams.get('l') || undefined, material: url.searchParams.get('m') || undefined, company: url.searchParams.get('c') || undefined };
    }
  } catch {
    /* kein URL – als Code behandeln */
  }
  return { code: text.trim() };
}
