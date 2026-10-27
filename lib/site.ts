/** Öffentliche Angaben der Website (Kontakt, Adresse) – bei Hostinger über NEXT_PUBLIC_* überschreibbar. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vysnone.com';
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hallo@vysnone.com';
/** Telefonnummer für Website und Support – wird nur angezeigt, wenn gesetzt (z. B. „+43 660 1234567“). */
export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE || '';
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
