import type { Data, DocKind, EmailSettings, InvoiceDesign, SalesDoc } from './types';

/**
 * Belegarten an einer Stelle: Bezeichnungen, Pfade, Nummernkreise, Texte, Status.
 * Listen, Editor, PDF, E-Mail und Dashboard lesen nur von hier.
 */
export type StatusDef = { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' };

export type DocKindConfig = {
  one: string;
  many: string;
  /** „ein Angebot“, „eine Rechnung“ … */
  article: 'ein' | 'eine';
  path: string;
  prefix: string;
  numberLabel: string;
  dateLabel: string;
  dueLabel: string;
  totalLabel: string;
  /** Empfänger: Kunde oder Lieferant */
  partner: 'Kunde' | 'Lieferant';
  /** Preise auf dem Beleg drucken (Lieferschein: nein) */
  prices: boolean;
  description: string;
  emptyText: string;
  intro: string;
  outro: string;
  mailSubject: string;
  mailBody: string;
  status: Partial<Record<SalesDoc['status'], StatusDef>>;
};

export const DOC_KINDS: Record<DocKind, DocKindConfig> = {
  offer: {
    one: 'Angebot', many: 'Angebote', article: 'ein', path: '/app/angebote', prefix: 'AN',
    numberLabel: 'Angebotsnr.', dateLabel: 'Angebotsdatum', dueLabel: 'Gültig bis', totalLabel: 'Angebotssumme', partner: 'Kunde', prices: true,
    description: 'Angebote erstellen und mit einem Klick in Auftragsbestätigungen oder Rechnungen umwandeln.',
    emptyText: 'Erstellen Sie Ihr erstes Angebot und wandeln Sie es später mit einem Klick in eine Rechnung um.',
    intro: '', outro: '', mailSubject: '', mailBody: '',
    status: {
      draft: { label: 'Entwurf', tone: 'neutral' }, sent: { label: 'Versendet', tone: 'info' },
      accepted: { label: 'Angenommen', tone: 'success' }, declined: { label: 'Abgelehnt', tone: 'danger' },
    },
  },
  confirmation: {
    one: 'Auftragsbestätigung', many: 'Auftragsbestätigungen', article: 'eine', path: '/app/auftragsbestaetigungen', prefix: 'AB',
    numberLabel: 'Auftragsnr.', dateLabel: 'Datum', dueLabel: 'Liefertermin', totalLabel: 'Auftragssumme', partner: 'Kunde', prices: true,
    description: 'Aufträge verbindlich bestätigen – daraus Lieferscheine und Rechnungen erzeugen.',
    emptyText: 'Bestätigen Sie einen Auftrag – am schnellsten direkt aus einem angenommenen Angebot.',
    intro: 'Vielen Dank für Ihren Auftrag. Hiermit bestätigen wir die folgenden Leistungen:',
    outro: 'Wir freuen uns auf die Zusammenarbeit.\nMit freundlichen Grüßen',
    mailSubject: 'Auftragsbestätigung {nummer} von {firma}',
    mailBody: 'Guten Tag,\n\nvielen Dank für Ihren Auftrag. Anbei erhalten Sie unsere Auftragsbestätigung {nummer}.\n\nMit freundlichen Grüßen\n{firma}',
    status: {
      draft: { label: 'Entwurf', tone: 'neutral' }, sent: { label: 'Bestätigt', tone: 'info' },
      accepted: { label: 'Erledigt', tone: 'success' }, cancelled: { label: 'Storniert', tone: 'neutral' },
    },
  },
  delivery: {
    one: 'Lieferschein', many: 'Lieferscheine', article: 'ein', path: '/app/lieferscheine', prefix: 'LS',
    numberLabel: 'Lieferschein-Nr.', dateLabel: 'Datum', dueLabel: 'Lieferdatum', totalLabel: '', partner: 'Kunde', prices: false,
    description: 'Lieferungen dokumentieren – ohne Preise, mit Unterschriftsfeld.',
    emptyText: 'Erstellen Sie einen Lieferschein – direkt aus einer Auftragsbestätigung oder Rechnung.',
    intro: 'Wir liefern Ihnen folgende Waren bzw. Leistungen:',
    outro: 'Ware in einwandfreiem Zustand erhalten:\n\n\n______________________________\nDatum, Unterschrift',
    mailSubject: 'Lieferschein {nummer} von {firma}',
    mailBody: 'Guten Tag,\n\nanbei erhalten Sie den Lieferschein {nummer}.\n\nMit freundlichen Grüßen\n{firma}',
    status: {
      draft: { label: 'Entwurf', tone: 'neutral' }, sent: { label: 'Geliefert', tone: 'success' }, cancelled: { label: 'Storniert', tone: 'neutral' },
    },
  },
  invoice: {
    one: 'Rechnung', many: 'Rechnungen', article: 'eine', path: '/app/rechnungen', prefix: 'RE',
    numberLabel: 'Rechnungsnr.', dateLabel: 'Rechnungsdatum', dueLabel: 'Zahlbar bis', totalLabel: 'Rechnungsbetrag', partner: 'Kunde', prices: true,
    description: 'Rechnungen gestalten, versenden und Zahlungseingänge verfolgen.',
    emptyText: 'Erstellen Sie Ihre erste Rechnung – Positionen aus dem Materialstamm übernehmen, PDF herunterladen, fertig.',
    intro: '', outro: '', mailSubject: '', mailBody: '',
    status: {
      draft: { label: 'Entwurf', tone: 'neutral' }, sent: { label: 'Offen', tone: 'info' },
      paid: { label: 'Bezahlt', tone: 'success' }, cancelled: { label: 'Storniert', tone: 'neutral' },
    },
  },
  order: {
    one: 'Bestellung', many: 'Bestellungen', article: 'eine', path: '/app/bestellungen', prefix: 'BE',
    numberLabel: 'Bestellnr.', dateLabel: 'Bestelldatum', dueLabel: 'Liefertermin', totalLabel: 'Bestellsumme', partner: 'Lieferant', prices: true,
    description: 'Material bei Lieferanten bestellen – beim Wareneingang wird der Bestand automatisch gebucht.',
    emptyText: 'Bestellen Sie Material bei Ihrem Lieferanten. Beim Wareneingang bucht VYSNER One den Bestand automatisch.',
    intro: 'Hiermit bestellen wir verbindlich:',
    outro: 'Bitte bestätigen Sie den Liefertermin.\nMit freundlichen Grüßen',
    mailSubject: 'Bestellung {nummer} von {firma}',
    mailBody: 'Guten Tag,\n\nanbei erhalten Sie unsere Bestellung {nummer}. Bitte bestätigen Sie den Liefertermin.\n\nMit freundlichen Grüßen\n{firma}',
    status: {
      draft: { label: 'Entwurf', tone: 'neutral' }, sent: { label: 'Bestellt', tone: 'info' },
      accepted: { label: 'Erhalten', tone: 'success' }, cancelled: { label: 'Storniert', tone: 'neutral' },
    },
  },
};

export const docConfig = (kind: DocKind) => DOC_KINDS[kind];
export const docPath = (kind: DocKind) => DOC_KINDS[kind].path;
export const docEditPath = (doc: Pick<SalesDoc, 'kind' | 'id'>) => `${DOC_KINDS[doc.kind].path}/bearbeiten?id=${doc.id}`;

/** Nummernkreis-Präfix: Rechnung/Angebot aus den Firmendaten, übrige aus den Einstellungen. */
export function docPrefix(data: Pick<Data, 'company' | 'settings'>, kind: DocKind) {
  if (kind === 'invoice') return data.company?.invoicePrefix || 'RE';
  if (kind === 'offer') return data.company?.offerPrefix || 'AN';
  return data.settings.numbers?.prefixes?.[kind] || DOC_KINDS[kind].prefix;
}

/** Standardtexte (Einleitung/Schluss) einer Belegart aus dem Design bzw. den Vorgaben. */
export function docTexts(design: InvoiceDesign, kind: DocKind) {
  if (kind === 'invoice') return { intro: design.invoiceIntro, outro: design.invoiceOutro };
  if (kind === 'offer') return { intro: design.offerIntro, outro: design.offerOutro };
  const own = design.texts?.[kind];
  return { intro: own?.intro ?? DOC_KINDS[kind].intro, outro: own?.outro ?? DOC_KINDS[kind].outro };
}

/** E-Mail-Vorlage (Betreff/Text) einer Belegart. */
export function docMail(email: EmailSettings, kind: DocKind) {
  if (kind === 'invoice') return { subject: email.invoiceSubject, body: email.invoiceBody };
  if (kind === 'offer') return { subject: email.offerSubject, body: email.offerBody };
  const own = email.templates?.[kind];
  return { subject: own?.subject || DOC_KINDS[kind].mailSubject, body: own?.body || DOC_KINDS[kind].mailBody };
}

/** Folgebelege, die sich aus einer Belegart erzeugen lassen. */
export const NEXT_KINDS: Record<DocKind, DocKind[]> = {
  offer: ['confirmation', 'invoice'],
  confirmation: ['delivery', 'invoice'],
  delivery: ['invoice'],
  invoice: ['delivery'],
  order: [],
};
