import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { agentTurn } from '../../../lib/server/agent';
import { aiActive, aiBookable, aiCostCapMicros, aiDailyLimit, aiMonthlyLimit } from '../../../lib/server/ai-addon';
import { getMailAccount } from '../../../lib/server/mailbox';
import { adminDb, memberRole, requestToken, userDb, userFromRequest } from '../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_HISTORY_CHARS = 400_000;

/**
 * Ist der Assistent buchbar? Ohne API-Schlüssel oder Stripe-Preis blendet die App ihn aus.
 * Mit ?companyId=… (angemeldet) zusätzlich die im laufenden Monat übrigen Aufgaben.
 */
export async function GET(req: Request) {
  const base = { enabled: aiBookable(), dailyLimit: aiDailyLimit(), monthlyLimit: aiMonthlyLimit() };
  const companyId = new URL(req.url).searchParams.get('companyId') || '';
  if (!companyId || !base.enabled) return NextResponse.json(base);
  const user = await userFromRequest(req);
  if (!user || !(await memberRole(companyId, user.id))) return NextResponse.json(base);
  const { data: used } = await adminDb().rpc('ai_month_usage', { p_company: companyId });
  return NextResponse.json({ ...base, remaining: Math.max(0, aiMonthlyLimit() - Number(used || 0)) });
}

/** Assistent (Zusatzbuchung, eigenes Abo): ein Gesprächsschritt = eine Aufgabe. */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Der Assistent ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt).' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) {
    // Ursache unterscheiden – hilft bei der Fehlersuche (Proxy entfernt Header, Server falsch eingerichtet, Sitzung abgelaufen)
    const reason = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? 'Der Server kennt die Datenbank nicht (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen). [A1]'
      : !requestToken(req)
        ? 'Ihre Anmeldung ist beim Server nicht angekommen. Bitte die Seite neu laden. [A2]'
        : 'Ihre Anmeldung ist abgelaufen. Bitte die Seite neu laden oder neu anmelden. [A3]';
    return NextResponse.json({ error: reason }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const text = String(body.text || '').trim().slice(0, 4000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!companyId || !text) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  if (JSON.stringify(history).length > MAX_HISTORY_CHARS) return NextResponse.json({ error: 'Das Gespräch ist zu lang – bitte neu beginnen.' }, { status: 413 });
  if (!(await memberRole(companyId, user.id))) return NextResponse.json({ error: 'Kein Zugriff auf diese Firma.' }, { status: 403 });

  const { data: company } = await adminDb().from('companies').select('name, owner, email, phone, default_vat, small_business, country, ai_status').eq('id', companyId).single();
  if (!company || !aiActive(company.ai_status)) {
    return NextResponse.json({ error: 'Der Assistent ist für diese Firma nicht gebucht.', upgrade: 'ai' }, { status: 402 });
  }
  // Tages-, Monats- und Kostenlimit: erst zählen, dann fragen – ohne Zähler (SQL fehlt) lieber gar nicht
  const { data: remaining, error: limitError } = await adminDb().rpc('ai_take', { p_company: companyId, p_daily: aiDailyLimit(), p_monthly: aiMonthlyLimit(), p_cost_cap: aiCostCapMicros() });
  if (limitError) {
    console.error('ai_take', limitError);
    return NextResponse.json({ error: 'Der Assistent ist noch nicht vollständig eingerichtet (Tageslimit fehlt).' }, { status: 503 });
  }
  if (remaining === -2 || remaining === -3) {
    return NextResponse.json({ error: `Das Monatsguthaben von ${aiMonthlyLimit()} Aufgaben ist aufgebraucht. Ab dem 1. des nächsten Monats geht es weiter.` }, { status: 429 });
  }
  if (remaining < 0) {
    return NextResponse.json({ error: `Das Tageslimit von ${aiDailyLimit()} Aufgaben ist für heute erreicht. Morgen geht es weiter.` }, { status: 429 });
  }
  const country = String(company.country || 'Deutschland');
  try {
    const mail = await getMailAccount(companyId).catch((e) => { console.error('mail account', e); return null; });
    const result = await agentTurn(history, text, {
      companyName: String(company.name || ''),
      owner: String(company.owner || ''),
      companyEmail: String(company.email || ''),
      companyPhone: String(company.phone || ''),
      mail,
      defaultVat: Number(company.default_vat ?? 19),
      smallBusiness: !!company.small_business,
      country,
      currency: /schweiz|switzerland|liechtenstein/i.test(country) ? 'CHF' : 'EUR',
    }, userDb(req), companyId);
    const { costMicros, ...rest } = result;
    const { error: costError } = await adminDb().rpc('ai_add_cost', { p_company: companyId, p_micros: costMicros });
    if (costError) console.error('ai_add_cost', costError);
    return NextResponse.json({ ...rest, remaining });
  } catch (e) {
    console.error('agent', e);
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Der Assistent ist gerade ausgelastet. Bitte in einem Moment erneut versuchen.' }, { status: 429 });
    if (e instanceof Anthropic.BadRequestError) return NextResponse.json({ error: 'Das Gespräch konnte nicht fortgesetzt werden – bitte neu beginnen.' }, { status: 400 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: 'Der Assistent ist falsch eingerichtet (API-Schlüssel ungültig).' }, { status: 503 });
    return NextResponse.json({ error: 'Der Assistent ist gerade nicht erreichbar. Bitte erneut versuchen.' }, { status: 502 });
  }
}
