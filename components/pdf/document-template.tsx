'use client';

import { docTotals, formatDate, lineNet, money, qty } from '../../lib/calc';
import { formatRate, taxProfile } from '../../lib/tax';
import { DOC_KINDS, docTexts } from '../../lib/docs';
import type { Company, InvoiceDesign, SalesDoc } from '../../lib/types';
import { Img, PageFrame, PageNumber, T, V } from './primitives';
import type { Style } from './primitives';

export type TemplateProps = { company: Company; doc: SalesDoc; design: InvoiceDesign; customerNumber?: string };

/** Mixes a hex colour with white; amount 0 = colour, 1 = white. */
export function tint(hex: string, amount: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#f2f2f2';
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

export function fillPlaceholders(text: string, doc: SalesDoc, gross: number) {
  return text
    .replace(/\{nummer\}/g, doc.number)
    .replace(/\{datum\}/g, formatDate(doc.date))
    .replace(/\{faellig\}/g, formatDate(doc.dueDate))
    .replace(/\{gueltig\}/g, formatDate(doc.dueDate))
    .replace(/\{kunde\}/g, doc.recipient.name)
    .replace(/\{betrag\}/g, money(gross));
}

const INK = '#1d232a';
const MUTED = '#6a717a';
const LINE = '#dcdfe3';

export function DocumentTemplate({ company, doc, design, customerNumber }: TemplateProps) {
  const isInvoice = doc.kind === 'invoice';
  const cfg = DOC_KINDS[doc.kind];
  const prices = cfg.prices;
  const defaults = docTexts(design, doc.kind);
  const tax = taxProfile(company);
  const totals = docTotals(doc.items, company.smallBusiness);
  const accent = design.accent;
  const font = design.font;
  const bold = { fontFamily: font, fontWeight: 'bold' } as Style;
  const title = cfg.one;
  const intro = fillPlaceholders(doc.intro || defaults.intro, doc, totals.gross);
  const outro = fillPlaceholders(doc.outro || defaults.outro, doc, totals.gross);
  const greeting = doc.recipient.contactPerson ? `Guten Tag ${doc.recipient.contactPerson},` : 'Sehr geehrte Damen und Herren,';
  const mixedVat = prices && !company.smallBusiness && new Set(doc.items.map((i) => i.vat)).size > 1;
  const hasDiscount = prices && doc.items.some((i) => i.discount > 0);
  const modern = design.layout === 'modern';
  const minimal = design.layout === 'minimal';

  const logoH = design.logoSize;
  const logoW = Math.min(logoH * (company.logoRatio || 1), 200);
  const logo = company.logo ? <Img src={company.logo} style={{ width: logoW, height: logoH }} /> : null;

  const senderLine = [company.name, company.street, [company.zip, company.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  const meta: [string, string][] = [
    [cfg.numberLabel, doc.number],
    [isInvoice ? 'Rechnungsdatum' : 'Datum', formatDate(doc.date)],
  ];
  if (customerNumber && doc.kind !== 'order') meta.push(['Kundennr.', customerNumber]);
  if (isInvoice && doc.serviceDate) meta.push(['Leistungsdatum', doc.serviceDate]);
  if (doc.dueDate) meta.push([cfg.dueLabel, formatDate(doc.dueDate)]);

  const page: Style = { fontFamily: font, fontSize: 9.5, color: INK, paddingTop: 42, paddingBottom: design.showFooter ? 96 : 50, paddingHorizontal: 50 };

  // ---------- Header ----------
  const contactBlock = (
    <V style={{ alignItems: design.logoPosition === 'right' ? 'flex-start' : 'flex-end' }}>
      <T style={[bold, { fontSize: 11, color: modern ? '#ffffff' : INK }]}>{company.name}</T>
      {[company.street, [company.zip, company.city].filter(Boolean).join(' '), company.phone, company.email, company.website].filter(Boolean).map((l) => (
        <T key={l} style={{ fontSize: 8, color: modern ? tint(accent, 0.75) : MUTED, textAlign: design.logoPosition === 'right' ? 'left' : 'right' }}>{l}</T>
      ))}
    </V>
  );

  const header = modern ? (
    <V style={{ backgroundColor: accent, marginTop: -42, marginHorizontal: -50, paddingHorizontal: 50, paddingTop: 30, paddingBottom: 24, marginBottom: 26, flexDirection: design.logoPosition === 'right' ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
      {contactBlock}
      {logo ? <V style={{ backgroundColor: '#ffffff', padding: 6, borderRadius: 4 }}>{logo}</V> : <V />}
    </V>
  ) : (
    <V style={{ flexDirection: design.logoPosition === 'right' ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 60, marginBottom: minimal ? 34 : 26 }}>
      {contactBlock}
      {logo || <V />}
    </V>
  );

  // ---------- Address + meta ----------
  const r = doc.recipient;
  const address = (
    <V style={{ width: '55%' }}>
      {design.showSenderLine && senderLine ? (
        <T style={{ fontSize: 6.8, color: MUTED, marginBottom: 7, textDecoration: minimal ? 'none' : 'underline' }}>{senderLine}</T>
      ) : null}
      {[r.name, r.contactPerson && r.contactPerson !== r.name ? r.contactPerson : '', r.street, [r.zip, r.city].filter(Boolean).join(' '), r.country && r.country !== 'Deutschland' ? r.country : ''].filter(Boolean).map((l, i) => (
        <T key={i} style={i === 0 ? [bold, { fontSize: 10 }] : { fontSize: 10 }}>{l}</T>
      ))}
      {r.vatId ? <T style={{ fontSize: 8, color: MUTED, marginTop: 3 }}>{tax.idLabel}: {r.vatId}</T> : null}
    </V>
  );

  const metaBlock = (
    <V style={{ width: '38%' }}>
      {meta.map(([k, v]) => (
        <V key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5, borderBottomWidth: minimal ? 0 : 0.5, borderBottomColor: LINE }}>
          <T style={{ fontSize: 8.5, color: MUTED }}>{k}</T>
          <T style={[bold, { fontSize: 8.5 }]}>{v}</T>
        </V>
      ))}
    </V>
  );

  // ---------- Table ----------
  const cols = {
    pos: design.showPositions ? 24 : 0,
    qty: 58,
    price: prices ? 64 : 0,
    discount: hasDiscount ? 38 : 0,
    vat: mixedVat ? 34 : 0,
    total: prices ? 70 : 0,
  };
  const headBg = design.tableStyle === 'lines' || minimal ? undefined : modern ? accent : tint(accent, 0.88);
  const headColor = modern && design.tableStyle !== 'lines' ? '#ffffff' : minimal ? MUTED : accent;
  const boxed = design.tableStyle === 'boxed';
  const cell = (w: number, align: 'left' | 'right' = 'right'): Style => ({ width: w, textAlign: align, paddingHorizontal: 3 });
  const headText: Style = { ...bold, fontSize: 7.8, color: headColor, textTransform: minimal ? 'uppercase' : undefined, letterSpacing: minimal ? 0.6 : 0 };

  const tableHead = (
    <V style={{ flexDirection: 'row', backgroundColor: headBg, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: design.tableStyle === 'lines' || minimal ? 1 : 0, borderBottomColor: minimal ? LINE : accent }}>
      {cols.pos ? <T style={[headText, cell(cols.pos, 'left')]}>Pos.</T> : null}
      <T style={[headText, { flex: 1, paddingHorizontal: 3 }]}>Beschreibung</T>
      <T style={[headText, cell(cols.qty)]}>Menge</T>
      {prices ? <T style={[headText, cell(cols.price)]}>Einzelpreis</T> : null}
      {cols.discount ? <T style={[headText, cell(cols.discount)]}>Rabatt</T> : null}
      {cols.vat ? <T style={[headText, cell(cols.vat)]}>{tax.label}</T> : null}
      {prices ? <T style={[headText, cell(cols.total)]}>Gesamt</T> : null}
    </V>
  );

  const rows = doc.items.map((item, i) => (
    <V key={item.id} wrap={false} style={{
      flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4,
      backgroundColor: design.tableStyle === 'striped' && i % 2 === 1 ? tint(accent, 0.95) : undefined,
      borderBottomWidth: design.tableStyle === 'striped' ? 0 : 0.5, borderBottomColor: LINE,
    }}>
      {cols.pos ? <T style={[cell(cols.pos, 'left'), { color: MUTED }]}>{i + 1}</T> : null}
      <V style={{ flex: 1, paddingHorizontal: 3 }}>
        {item.variant ? <T style={[bold, { fontSize: 7, color: accent, letterSpacing: 0.5, marginBottom: 1 }]}>{item.variant === 'optional' ? 'OPTIONAL' : 'ALTERNATIVE'}</T> : null}
        <T style={bold}>{item.description || '—'}</T>
        {item.details ? <T style={{ fontSize: 8.2, color: MUTED, marginTop: 1 }}>{item.details}</T> : null}
      </V>
      <T style={cell(cols.qty)}>{`${qty(item.quantity)} ${item.unit}`}</T>
      {prices ? <T style={cell(cols.price)}>{money(item.unitPrice)}</T> : null}
      {cols.discount ? <T style={cell(cols.discount)}>{item.discount ? `${qty(item.discount)} %` : ''}</T> : null}
      {cols.vat ? <T style={cell(cols.vat)}>{formatRate(item.vat)}</T> : null}
      {prices ? <T style={item.variant ? [cell(cols.total), { color: MUTED }] : [cell(cols.total), bold]}>{item.variant ? `(${money(lineNet(item))})` : money(lineNet(item))}</T> : null}
    </V>
  ));

  const totalRow = (label: string, value: string, strong = false) => (
    <V key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: strong ? 5 : 2, paddingHorizontal: strong ? 6 : 0, marginTop: strong ? 4 : 0, backgroundColor: strong && !minimal ? (modern ? accent : tint(accent, 0.9)) : undefined, borderTopWidth: strong && minimal ? 1 : 0, borderTopColor: INK }}>
      <T style={strong ? [bold, { fontSize: 10.5, color: modern ? '#ffffff' : INK }] : { color: MUTED }}>{label}</T>
      <T style={strong ? [bold, { fontSize: 10.5, color: modern ? '#ffffff' : INK }] : {}}>{value}</T>
    </V>
  );

  const totalsBlock = (
    <V wrap={false} style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
      <V style={{ width: 220 }}>
        {company.smallBusiness ? null : totalRow('Nettobetrag', money(totals.net))}
        {company.smallBusiness ? null : totals.vatGroups.map((g) => totalRow(`zzgl. ${formatRate(g.rate)} ${tax.label} auf ${money(g.net)}`, money(g.vat)))}
        {totalRow(cfg.totalLabel, money(totals.gross), true)}
      </V>
    </V>
  );

  // ---------- Footer ----------
  const footerCols: string[][] = [
    [company.name, company.street, [company.zip, company.city].filter(Boolean).join(' '), company.owner ? `Inhaber/GF: ${company.owner}` : ''],
    [company.phone ? `Tel. ${company.phone}` : '', company.email, company.website],
    [company.bankName, company.iban ? `IBAN ${company.iban}` : '', company.bic ? `BIC ${company.bic}` : ''],
    [company.taxNumber ? `${tax.taxNumberShort} ${company.taxNumber}` : '', company.vatId ? `${tax.idLabel} ${company.vatId}` : '', company.registerCourt, company.registerNumber],
  ].map((c) => c.filter(Boolean)).filter((c) => c.length);

  const footer = design.showFooter ? (
    <V fixed style={{ position: 'absolute', bottom: 28, left: 50, right: 50, borderTopWidth: minimal ? 0 : 0.75, borderTopColor: modern ? accent : LINE, paddingTop: 8 }}>
      <V style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {footerCols.map((c, i) => (
          <V key={i} style={{ flex: 1, paddingRight: 6 }}>
            {c.map((l) => <T key={l} style={{ fontSize: 6.8, color: MUTED }}>{l}</T>)}
          </V>
        ))}
      </V>
      {design.showPageNumbers ? <PageNumber style={{ fontSize: 6.8, color: MUTED, textAlign: 'right', marginTop: 4 }} /> : null}
    </V>
  ) : design.showPageNumbers ? (
    <V fixed style={{ position: 'absolute', bottom: 24, left: 50, right: 50 }}><PageNumber style={{ fontSize: 6.8, color: MUTED, textAlign: 'right' }} /></V>
  ) : null;

  return (
    <PageFrame style={page} title={`${title} ${doc.number}`}>
      {header}
      <V style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 30 }}>
        {address}
        {metaBlock}
      </V>
      <T style={[bold, { fontSize: minimal ? 13 : 17, color: minimal ? INK : accent, letterSpacing: minimal ? 1.5 : 0, textTransform: minimal ? 'uppercase' : undefined }]}>{`${title} ${doc.number}`}</T>
      {doc.subject ? <T style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{doc.subject}</T> : null}
      <V style={{ marginTop: 16, marginBottom: 14 }}>
        <T>{greeting}</T>
        {intro ? <T style={{ marginTop: 6 }}>{intro}</T> : null}
      </V>
      <V style={boxed ? { borderTopWidth: 0.75, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderLeftWidth: 0.75, borderTopColor: LINE, borderRightColor: LINE, borderBottomColor: LINE, borderLeftColor: LINE } : undefined}>
        {tableHead}
        {rows.length ? rows : <T style={{ padding: 10, color: MUTED }}>Noch keine Positionen erfasst.</T>}
      </V>
      {prices ? totalsBlock : null}
      {prices && doc.items.some((i) => i.variant) ? (
        <T style={{ marginTop: 8, fontSize: 8.2, color: MUTED }}>Optionale Positionen und Alternativen (Beträge in Klammern) sind in der {cfg.totalLabel || 'Summe'} nicht enthalten.</T>
      ) : null}
      {prices && company.smallBusiness ? <T style={{ marginTop: 10, fontSize: 8.5, color: MUTED }}>{tax.smallBusinessNote}</T> : null}
      {outro ? <T wrap={false} style={{ marginTop: 18 }}>{outro}</T> : null}
      {company.owner ? <T style={{ marginTop: 4 }}>{company.owner}</T> : null}
      {footer}
    </PageFrame>
  );
}
