import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { docTotals, formatDate, lineNet, money, positionLabels, qty } from '../shared/calc';
import { DOC_KINDS, docTexts } from '../shared/docs';
import { formatRate, taxProfile } from '../shared/tax';
import type { Data, SalesDoc } from '../shared/types';

const esc = (s: string | undefined | null) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (s: string) => esc(s).replace(/\n/g, '<br>');

export function fillPlaceholders(text: string, doc: SalesDoc, gross: number) {
  return text
    .replace(/\{nummer\}/g, doc.number)
    .replace(/\{datum\}/g, formatDate(doc.date))
    .replace(/\{faellig\}/g, formatDate(doc.dueDate))
    .replace(/\{gueltig\}/g, formatDate(doc.dueDate))
    .replace(/\{kunde\}/g, doc.recipient.name)
    .replace(/\{betrag\}/g, money(gross));
}

/** Beleg als HTML (A4) – gleicher Aufbau wie das PDF der Website. */
export function docHtml(data: Data, doc: SalesDoc) {
  const company = data.company!;
  const design = data.design;
  const cfg = DOC_KINDS[doc.kind];
  const prices = cfg.prices;
  const tax = taxProfile(company);
  const totals = docTotals(doc.items, company.smallBusiness);
  const defaults = docTexts(design, doc.kind);
  const intro = fillPlaceholders(doc.intro || defaults.intro, doc, totals.gross);
  const outro = fillPlaceholders(doc.outro || defaults.outro, doc, totals.gross);
  const accent = design.accent || '#13873e';
  const labels = positionLabels(doc.items);
  const customer = data.customers.find((c) => c.id === doc.customerId);
  const r = doc.recipient;
  const mixedVat = prices && !company.smallBusiness && new Set(doc.items.map((i) => i.vat)).size > 1;
  const hasDiscount = prices && doc.items.some((i) => i.discount > 0);

  const meta: [string, string][] = [[cfg.numberLabel, doc.number], [doc.kind === 'invoice' ? 'Rechnungsdatum' : 'Datum', formatDate(doc.date)]];
  if (customer?.number && doc.kind !== 'order') meta.push(['Kundennr.', customer.number]);
  if (doc.kind === 'invoice' && doc.serviceDate) meta.push(['Leistungsdatum', doc.serviceDate]);
  if (doc.dueDate) meta.push([cfg.dueLabel, formatDate(doc.dueDate)]);

  const address = [r.name, r.contactPerson && r.contactPerson !== r.name ? r.contactPerson : '', r.street, [r.zip, r.city].filter(Boolean).join(' '),
    r.country && r.country !== (company.country || 'Deutschland') ? r.country : ''].filter(Boolean);
  const sender = [company.name, company.street, [company.zip, company.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  const rows = doc.items.map((item, i) => {
    const variant = item.variant
      ? `<div class="variant">${item.variant === 'optional' ? 'OPTIONAL' : item.parentId ? `ALTERNATIVE ZU POS. ${labels[doc.items.findIndex((x) => x.id === item.parentId)] ?? ''}` : 'ALTERNATIVE'}</div>`
      : '';
    const amount = (v: string) => (item.variant ? `(${v})` : v);
    return `<tr${item.parentId ? ' class="alt"' : ''}>
      <td class="pos">${esc(labels[i])}</td>
      <td>${variant}<strong>${esc(item.description)}</strong>${item.details ? `<div class="det">${lines(item.details)}</div>` : ''}</td>
      <td class="num">${qty(item.quantity)} ${esc(item.unit)}</td>
      ${prices ? `<td class="num">${money(item.unitPrice)}</td>` : ''}
      ${hasDiscount ? `<td class="num">${item.discount ? `${qty(item.discount)} %` : ''}</td>` : ''}
      ${mixedVat ? `<td class="num">${formatRate(item.vat)}</td>` : ''}
      ${prices ? `<td class="num">${amount(money(lineNet(item)))}</td>` : ''}
    </tr>`;
  }).join('');

  const totalRows = prices ? `
    <table class="totals">
      ${company.smallBusiness ? '' : `<tr><td>Nettobetrag</td><td class="num">${money(totals.net)}</td></tr>`}
      ${company.smallBusiness ? '' : totals.vatGroups.map((g) => `<tr><td>zzgl. ${formatRate(g.rate)} ${esc(tax.label)} auf ${money(g.net)}</td><td class="num">${money(g.vat)}</td></tr>`).join('')}
      <tr class="sum"><td>${esc(cfg.totalLabel || 'Summe')}</td><td class="num">${money(totals.gross)}</td></tr>
    </table>` : '';

  const footer = design.showFooter ? `<div class="footer">${[
    [company.name, company.street, [company.zip, company.city].filter(Boolean).join(' '), company.owner ? `Inhaber/GF: ${company.owner}` : ''],
    [company.phone ? `Tel. ${company.phone}` : '', company.email, company.website],
    [company.bankName, company.iban ? `IBAN ${company.iban}` : '', company.bic ? `BIC ${company.bic}` : ''],
    [company.taxNumber ? `${tax.taxNumberShort} ${company.taxNumber}` : '', company.vatId ? `${tax.idLabel} ${company.vatId}` : '', company.registerCourt, company.registerNumber],
  ].map((c) => `<div>${c.filter(Boolean).map(esc).join('<br>')}</div>`).join('')}</div>` : '';

  const logo = company.logo ? `<img class="logo" src="${esc(company.logo)}" style="height:${design.logoSize || 48}px">` : `<div class="cname">${esc(company.name)}</div>`;

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 16mm 16mm 30mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #1d232a; margin: 0; }
  .head { display: flex; justify-content: ${design.logoPosition === 'left' ? 'flex-start' : 'flex-end'}; margin-bottom: 28px; }
  .logo { max-width: 220px; object-fit: contain; }
  .cname { font-size: 15pt; font-weight: bold; color: ${accent}; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; }
  .sender { font-size: 7pt; color: #6a717a; text-decoration: underline; margin-bottom: 6px; }
  .meta td { padding: 1px 0 1px 14px; font-size: 9pt; } .meta td:first-child { color: #6a717a; padding-left: 0; }
  h1 { font-size: 16pt; color: ${accent}; margin: 0; }
  .subject { color: #6a717a; margin-top: 2px; }
  .intro { margin: 16px 0 14px; white-space: normal; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { text-align: left; font-size: 8pt; color: #6a717a; border-bottom: 1.5px solid ${accent}; padding: 6px 4px; }
  table.items td { border-bottom: 0.5px solid #dcdfe3; padding: 7px 4px; vertical-align: top; }
  .pos { color: #6a717a; width: 34px; } .num { text-align: right; white-space: nowrap; }
  table.items th.num { text-align: right; }
  .det { color: #6a717a; font-size: 8.8pt; margin-top: 2px; }
  .variant { font-size: 7pt; font-weight: bold; color: ${accent}; letter-spacing: .5px; }
  tr.alt td { color: #4a5159; }
  table.totals { margin: 10px 0 0 auto; border-collapse: collapse; min-width: 52%; }
  table.totals td { padding: 3px 4px; } table.totals tr.sum td { font-weight: bold; font-size: 11pt; border-top: 1.5px solid ${accent}; padding-top: 6px; }
  .muted { color: #6a717a; font-size: 8.5pt; margin-top: 8px; }
  .outro { margin-top: 18px; }
  .footer { position: fixed; bottom: -22mm; left: 0; right: 0; display: flex; gap: 14px; border-top: 0.5px solid #dcdfe3; padding-top: 6px; font-size: 6.8pt; color: #6a717a; }
  .footer div { flex: 1; }
</style></head><body>
  <div class="head">${logo}</div>
  <div class="top">
    <div>${design.showSenderLine ? `<div class="sender">${esc(sender)}</div>` : ''}${address.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    <table class="meta">${meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
  </div>
  <h1>${esc(cfg.one)} ${esc(doc.number)}</h1>
  ${doc.subject ? `<div class="subject">${esc(doc.subject)}</div>` : ''}
  <div class="intro">${r.contactPerson ? `Guten Tag ${esc(r.contactPerson)},` : 'Sehr geehrte Damen und Herren,'}${intro ? `<br><br>${lines(intro)}` : ''}</div>
  <table class="items">
    <tr><th>Pos.</th><th>Bezeichnung</th><th class="num">Menge</th>${prices ? '<th class="num">Einzelpreis</th>' : ''}${hasDiscount ? '<th class="num">Rabatt</th>' : ''}${mixedVat ? `<th class="num">${esc(tax.label)}</th>` : ''}${prices ? '<th class="num">Gesamt</th>' : ''}</tr>
    ${rows || '<tr><td colspan="6" class="muted">Noch keine Positionen erfasst.</td></tr>'}
  </table>
  ${totalRows}
  ${prices && doc.items.some((i) => i.variant) ? `<div class="muted">Optionale Positionen und Alternativen (Beträge in Klammern) sind in der ${esc(cfg.totalLabel || 'Summe')} nicht enthalten.</div>` : ''}
  ${prices && company.smallBusiness ? `<div class="muted">${esc(tax.smallBusinessNote)}</div>` : ''}
  ${outro ? `<div class="outro">${lines(outro)}</div>` : ''}
  ${company.owner ? `<div>${esc(company.owner)}</div>` : ''}
  ${footer}
</body></html>`;
}

export const docFileName = (doc: SalesDoc) =>
  `${DOC_KINDS[doc.kind].one} ${doc.number}${doc.recipient.name ? ` ${doc.recipient.name}` : ''}.pdf`.replace(/[^\w\-. äöüÄÖÜß]+/g, '_');

/** PDF erzeugen (A4) und mit dem Teilen-Menü des Geräts weitergeben (Mail, WhatsApp, Dateien, Drucken …). */
export async function shareDocPdf(data: Data, doc: SalesDoc) {
  const { uri } = await Print.printToFileAsync({ html: docHtml(data, doc), width: 595, height: 842, margins: { left: 40, right: 40, top: 40, bottom: 70 } });
  const file = new File(uri);
  const named = new File(Paths.cache, docFileName(doc));
  if (named.exists) named.delete();
  await file.move(named);
  await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${DOC_KINDS[doc.kind].one} ${doc.number}` });
}

/** Direkt drucken (AirPrint / Android-Druckdienst) */
export const printDoc = (data: Data, doc: SalesDoc) => Print.printAsync({ html: docHtml(data, doc) });
