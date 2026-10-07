import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { docTotals, isOverdue, profitLoss, today } from '../calc';
import { documentFromRow, expenseFromRow } from '../db/mappers';
import type { Company, Data } from '../types';

/**
 * KI-Sprachassistent: versteht ein (diktiertes) Anliegen, sucht Kunden und Artikel in der
 * Firma, stellt Rückfragen bei Mehrdeutigkeit und schlägt einen Belegentwurf vor.
 * Angelegt wird erst, wenn der Nutzer den Vorschlag in der App bestätigt.
 */
export const AGENT_MODEL = 'claude-sonnet-5-5';
const MAX_STEPS = 8;

export type AgentProposal = {
  kind: 'offer' | 'confirmation' | 'delivery' | 'invoice' | 'order';
  customer_id: string;
  recipient_name: string;
  subject: string;
  items: { material_id: string; description: string; details: string; quantity: number; unit: string; unit_price: number; vat: number }[];
};

export type AgentContext = { companyName: string; defaultVat: number; smallBusiness: boolean; country: string; currency: string };

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_customers',
    description: 'Sucht Kunden (und Lieferanten) der Firma nach Name, Ansprechpartner, Ort oder Kundennummer. Immer verwenden, bevor ein Kunde zugeordnet wird.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Suchbegriff, z. B. „Müller“ oder „Bäckerei Huber Linz“' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_materials',
    description: 'Sucht Artikel und Leistungen im Materialstamm nach Name, Beschreibung, Kategorie oder Artikelnummer. Liefert Preis, Einheit, USt.-Satz und Bestand. Immer verwenden, bevor ein Artikel in einen Beleg übernommen wird.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Suchbegriff, z. B. „Gira Steckdose“' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_figures',
    description: 'Kennzahlen eines Zeitraums: Umsatz (gestellt und bezahlt), Ausgaben, sonstige Erträge, Ergebnis, Umsatzsteuer/Vorsteuer, Anzahl Rechnungen, Ausgaben je Kategorie. Für Fragen wie „Wie viel Umsatz diesen Monat?“ oder „Wie lief das Quartal?“.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Startdatum JJJJ-MM-TT (inklusive)' },
        to: { type: 'string', description: 'Enddatum JJJJ-MM-TT (inklusive)' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_open_items',
    description: 'Offene Posten und Aufgaben: offene und überfällige Rechnungen (Forderungen) mit Kunde, Betrag, Fälligkeit und Verzug in Tagen; offene Angebote; Entwürfe; Artikel unter Mindestbestand.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'propose_document',
    description: 'Zeigt dem Nutzer einen fertigen Belegentwurf zur Bestätigung. Erst aufrufen, wenn Kunde und alle Positionen eindeutig sind. Es wird nichts angelegt, bevor der Nutzer bestätigt.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['offer', 'confirmation', 'delivery', 'invoice', 'order'], description: 'offer = Angebot, confirmation = Auftragsbestätigung, delivery = Lieferschein, invoice = Rechnung, order = Bestellung beim Lieferanten' },
        customer_id: { type: 'string', description: 'ID aus search_customers, leer wenn der Kunde nicht im Kundenstamm ist' },
        recipient_name: { type: 'string', description: 'Name des Empfängers (bei bekanntem Kunden dessen Name)' },
        subject: { type: 'string', description: 'Kurzer Betreff, z. B. „Elektroarbeiten Küche“, sonst leer' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              material_id: { type: 'string', description: 'ID aus search_materials, leer bei freier Position (z. B. Arbeitszeit)' },
              description: { type: 'string' },
              details: { type: 'string', description: 'Zusatzbeschreibung, sonst leer' },
              quantity: { type: 'number' },
              unit: { type: 'string', description: 'z. B. Stück, Std., Pauschal, m, m²' },
              unit_price: { type: 'number', description: 'Nettopreis je Einheit in der Firmenwährung' },
              vat: { type: 'number', description: 'USt.-Satz in Prozent' },
            },
            required: ['material_id', 'description', 'details', 'quantity', 'unit', 'unit_price', 'vat'],
            additionalProperties: false,
          },
        },
      },
      required: ['kind', 'customer_id', 'recipient_name', 'subject', 'items'],
      additionalProperties: false,
    },
  },
];

function systemPrompt(ctx: AgentContext) {
  return `Du bist der Sprachassistent von VYSNER One, einer Software für Angebote, Rechnungen und Lager kleiner Betriebe. Du arbeitest für die Firma „${ctx.companyName}“ (${ctx.country}, Währung ${ctx.currency}).

Die Nachrichten des Nutzers sind meist per Spracherkennung diktiert – rechne mit Tippfehlern, fehlender Zeichensetzung und umgangssprachlichen Formulierungen („zwei Steckdosen von Gira“, „Arbeit pauschal zwanzig Euro“).

So gehst du vor:
- Suche Kunden immer mit search_customers und Artikel immer mit search_materials, bevor du sie verwendest. Erfinde keine IDs, Preise oder Artikel.
- Passt mehr als ein Treffer (z. B. eine Steckdose in Weiß, Schwarz und Anthrazit, oder zwei Kunden namens Müller), frage kurz nach und nenne die Möglichkeiten mit Unterscheidungsmerkmal und Preis. Stelle möglichst alle offenen Fragen in einer Nachricht.
- Gibt es keinen passenden Artikel, biete an, ihn als freie Position mit genanntem Preis aufzunehmen.
- Freie Leistungen wie Arbeitszeit, Anfahrt oder Pauschalen sind freie Positionen (material_id leer). Genannte Beträge sind Nettopreise, außer der Nutzer sagt ausdrücklich brutto.
- Standard-USt.-Satz der Firma: ${ctx.smallBusiness ? '0 % (Kleinunternehmer)' : `${ctx.defaultVat} %`}; bei Artikeln aus dem Materialstamm gilt deren Satz.
- Ohne andere Angabe ist der Beleg ein Angebot. Bei einer Bestellung an einen Lieferanten verwende den Einkaufspreis.
- Sobald alles eindeutig ist, rufe propose_document auf. Der Nutzer bestätigt den Entwurf selbst in der App; danach kann er weitere Änderungen ansagen, dann schlägst du einen neuen Entwurf vor.

Fragen zu Zahlen und offenen Posten:
- Heute ist der ${today()}. Für „diesen Monat“, „letztes Quartal“, „dieses Jahr“ rechne die Daten selbst aus und nutze get_figures; für offene Rechnungen, überfällige Forderungen, offene Angebote oder Lagerbestand list_open_items.
- Nenne Beträge mit Währung und unterscheide „gestellt“ (Rechnungsdatum) und „bezahlt“ (Zahlungseingang), wenn beides abweicht. Erfinde nie Zahlen – nur was die Werkzeuge liefern.

Hilfe und Tipps:
- Du darfst praktische Tipps für den Betrieb geben, z. B. zu Mahnungen, Zahlungszielen, Skonto, Liquidität, Angebotsnachverfolgung, Lagerhaltung und zur Bedienung von VYSNER One (Menü: Dokumente, Kunden, Material & Lager, Buchführung, Berichte; Einstellungen im Konto-Menü oben rechts).
- Bei Steuer- und Rechtsfragen gibst du nur allgemeine Orientierung und empfiehlst für den Einzelfall die Steuerberatung.

Antworte auf Deutsch, kurz und freundlich – deine Antworten werden oft vorgelesen. Keine Aufzählungszeichen-Romane, keine Markdown-Tabellen.`;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

function rank<T>(rows: T[], text: (r: T) => string, query: string, limit: number) {
  const terms = norm(query).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (!terms.length) return rows.slice(0, limit);
  return rows
    .map((r) => {
      const hay = norm(text(r));
      return { r, hits: terms.filter((t) => hay.includes(t)).length };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((x) => x.r);
}

async function runTool(name: string, input: Record<string, unknown>, db: SupabaseClient, companyId: string): Promise<string> {
  const query = String(input.query || '');
  if (name === 'search_customers') {
    const { data, error } = await db.from('customers').select('id, number, name, contact_person, street, zip, city, email').eq('company_id', companyId).limit(5000);
    if (error) throw new Error(error.message);
    const hits = rank(data || [], (c) => `${c.number} ${c.name} ${c.contact_person} ${c.city} ${c.email}`, query, 8);
    return JSON.stringify(hits.length ? hits : { result: 'Kein Kunde gefunden.' });
  }
  if (name === 'search_materials') {
    const { data, error } = await db.from('materials').select('id, number, name, description, category, unit, sale_price, purchase_price, vat, stock').eq('company_id', companyId).limit(5000);
    if (error) throw new Error(error.message);
    const hits = rank(data || [], (m) => `${m.number} ${m.name} ${m.description} ${m.category}`, query, 15);
    return JSON.stringify(hits.length ? hits : { result: 'Kein Artikel gefunden.' });
  }
  if (name === 'get_figures' || name === 'list_open_items') {
    const data = await loadData(db, companyId);
    if (name === 'list_open_items') return JSON.stringify(openItems(data));
    const from = String(input.from || today().slice(0, 8) + '01');
    const to = String(input.to || today());
    const small = !!data.company?.smallBusiness;
    const accrual = profitLoss(data, { from, to, label: '' }, 'accrual');
    const cash = profitLoss(data, { from, to, label: '' }, 'cash');
    const round = (n: number) => Math.round(n * 100) / 100;
    return JSON.stringify({
      zeitraum: { from, to },
      hinweis: small ? 'Kleinunternehmer: Beträge brutto, keine Umsatzsteuer.' : 'Beträge netto.',
      umsatz_gestellt_nach_rechnungsdatum: round(accrual.revenue),
      umsatz_bezahlt_nach_zahlungseingang: round(cash.revenue),
      rechnungen_gestellt: accrual.invoices,
      wareneinsatz: round(accrual.costOfSalesTotal),
      rohertrag: round(accrual.grossProfit),
      betriebsausgaben: round(accrual.operatingTotal),
      sonstige_ertraege: round(accrual.otherIncomeTotal),
      ergebnis_nach_rechnungsdatum: round(accrual.result),
      ergebnis_nach_zahlungseingang: round(cash.result),
      umsatzsteuer: round(accrual.outputVat),
      vorsteuer: round(accrual.inputVat),
      ust_zahllast: round(accrual.vatPayable),
      marge_prozent: round(accrual.margin * 100),
      ausgaben_je_kategorie: [...accrual.costOfSales, ...accrual.operating].map((c) => ({ kategorie: c.category, betrag: round(c.amount) })),
    });
  }
  throw new Error(`Unbekanntes Werkzeug ${name}`);
}

export type AgentTurn = { messages: Anthropic.Beta.BetaMessageParam[]; reply: string; proposal: AgentProposal | null };

/** Ein Gesprächsschritt: Agent-Schleife bis zur Antwort, Rückfrage oder zum Belegvorschlag. */
export async function agentTurn(history: Anthropic.Beta.BetaMessageParam[], text: string, ctx: AgentContext, db: SupabaseClient, companyId: string): Promise<AgentTurn> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: 'user', content: text }];
  let reply = '';
  let proposal: AgentProposal | null = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: AGENT_MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      system: systemPrompt(ctx),
      tools: TOOLS,
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    reply = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();

    if (response.stop_reason === 'refusal') return { messages, reply: 'Dabei kann ich leider nicht helfen.', proposal: null };
    if (response.stop_reason === 'pause_turn') continue;
    if (response.stop_reason !== 'tool_use') break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const input = block.input as Record<string, unknown>;
      if (block.name === 'propose_document') {
        proposal = input as unknown as AgentProposal;
        results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Der Entwurf wird dem Nutzer angezeigt. Er bestätigt ihn selbst oder sagt Änderungen an.' });
        continue;
      }
      try {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: await runTool(block.name, input, db, companyId) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: `Fehler: ${(e as Error).message}`, is_error: true });
      }
    }
    messages.push({ role: 'user', content: results });
    // Mit dem Vorschlag endet der Schritt – der Nutzer ist am Zug
    if (proposal) break;
  }
  return { messages, reply, proposal };
}

/** Belege, Buchungen und Artikel der Firma laden (für Auswertungen). */
async function loadData(db: SupabaseClient, companyId: string): Promise<Data> {
  const [company, docs, expenses, materials] = await Promise.all([
    db.from('companies').select('small_business, default_vat, country').eq('id', companyId).single(),
    db.from('documents').select('*').eq('company_id', companyId).limit(20000),
    db.from('expenses').select('*').eq('company_id', companyId).limit(20000),
    db.from('materials').select('id, number, name, unit, stock, min_stock').eq('company_id', companyId).limit(5000),
  ]);
  for (const r of [company, docs, expenses, materials]) if (r.error) throw new Error(r.error.message);
  return {
    company: { smallBusiness: !!company.data?.small_business, defaultVat: Number(company.data?.default_vat ?? 19), country: String(company.data?.country || '') } as Company,
    documents: (docs.data || []).map(documentFromRow),
    expenses: (expenses.data || []).map(expenseFromRow),
    materials: (materials.data || []).map((m) => ({ id: m.id, number: m.number, name: m.name, unit: m.unit, stock: Number(m.stock), minStock: Number(m.min_stock) })),
  } as unknown as Data;
}

function openItems(data: Data) {
  const small = !!data.company?.smallBusiness;
  const now = today();
  const days = (d: string) => Math.round((Date.parse(now) - Date.parse(d)) / 86400000);
  const gross = (items: Data['documents'][number]['items']) => Math.round(docTotals(items, small).gross * 100) / 100;
  const open = data.documents.filter((d) => d.kind === 'invoice' && d.status === 'sent');
  return {
    heute: now,
    offene_rechnungen: open.map((d) => ({
      nummer: d.number, kunde: d.recipient.name, betrag_brutto: gross(d.items), rechnungsdatum: d.date, faellig: d.dueDate,
      ueberfaellig_tage: isOverdue(d) ? days(d.dueDate) : 0,
    })).sort((a, b) => b.ueberfaellig_tage - a.ueberfaellig_tage),
    summe_offen: Math.round(open.reduce((s, d) => s + docTotals(d.items, small).gross, 0) * 100) / 100,
    summe_ueberfaellig: Math.round(open.filter(isOverdue).reduce((s, d) => s + docTotals(d.items, small).gross, 0) * 100) / 100,
    offene_angebote: data.documents.filter((d) => d.kind === 'offer' && d.status === 'sent').map((d) => ({ nummer: d.number, kunde: d.recipient.name, betrag_brutto: gross(d.items), gueltig_bis: d.dueDate })),
    entwuerfe: data.documents.filter((d) => d.status === 'draft').length,
    unter_mindestbestand: (data.materials as unknown as { number: string; name: string; unit: string; stock: number; minStock: number }[])
      .filter((m) => m.minStock > 0 && m.stock <= m.minStock).map((m) => ({ artikel: `${m.number} ${m.name}`, bestand: m.stock, mindestbestand: m.minStock, einheit: m.unit })),
  };
}
