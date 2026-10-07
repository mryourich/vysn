import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { agentTurn } from '../../../lib/server/agent';
import { aiActive, aiBookable, aiDailyLimit, aiMonthlyLimit } from '../../../lib/server/ai-addon';
import { adminDb, memberRole, userDb, userFromRequest } from '../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_HISTORY_CHARS = 400_000;

/** Ist der Assistent buchbar? Ohne API-Schlüssel oder Stripe-Preis blendet die App ihn aus. */
export async function GET() {
  return NextResponse.json({ enabled: aiBookable(), dailyLimit: aiDailyLimit(), monthlyLimit: aiMonthlyLimit() });
}

/** KI-Sprachassistent (Zusatzbuchung, eigenes Abo): ein Gesprächsschritt. */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Der KI-Assistent ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt).' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte melden Sie sich an.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId = String(body.companyId || '');
  const text = String(body.text || '').trim().slice(0, 4000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!companyId || !text) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  if (JSON.stringify(history).length > MAX_HISTORY_CHARS) return NextResponse.json({ error: 'Das Gespräch ist zu lang – bitte neu beginnen.' }, { status: 413 });
  if (!(await memberRole(companyId, user.id))) return NextResponse.json({ error: 'Kein Zugriff auf diese Firma.' }, { status: 403 });

  const { data: company } = await adminDb().from('companies').select('name, default_vat, small_business, country, ai_status').eq('id', companyId).single();
  if (!company || !aiActive(company.ai_status)) {
    return NextResponse.json({ error: 'Der KI-Sprachassistent ist für diese Firma nicht gebucht.', upgrade: 'ai' }, { status: 402 });
  }
  // Tages- und Monatslimit: erst zählen, dann fragen – ohne Zähler (SQL fehlt) lieber gar nicht
  const { data: remaining, error: limitError } = await adminDb().rpc('ai_take', { p_company: companyId, p_daily: aiDailyLimit(), p_monthly: aiMonthlyLimit() });
  if (limitError) {
    console.error('ai_take', limitError);
    return NextResponse.json({ error: 'Der KI-Assistent ist noch nicht vollständig eingerichtet (Tageslimit fehlt).' }, { status: 503 });
  }
  if (remaining === -2) {
    return NextResponse.json({ error: `Das Monatskontingent von ${aiMonthlyLimit()} Anfragen ist aufgebraucht. Ab dem 1. des nächsten Monats geht es weiter.` }, { status: 429 });
  }
  if (remaining < 0) {
    return NextResponse.json({ error: `Das Tageslimit von ${aiDailyLimit()} Anfragen ist für heute erreicht. Morgen geht es weiter.` }, { status: 429 });
  }
  const country = String(company.country || 'Deutschland');
  try {
    const result = await agentTurn(history, text, {
      companyName: String(company.name || ''),
      defaultVat: Number(company.default_vat ?? 19),
      smallBusiness: !!company.small_business,
      country,
      currency: /schweiz|switzerland|liechtenstein/i.test(country) ? 'CHF' : 'EUR',
    }, userDb(req), companyId);
    return NextResponse.json({ ...result, remaining });
  } catch (e) {
    console.error('agent', e);
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Der Assistent ist gerade ausgelastet. Bitte in einem Moment erneut versuchen.' }, { status: 429 });
    if (e instanceof Anthropic.BadRequestError) return NextResponse.json({ error: 'Das Gespräch konnte nicht fortgesetzt werden – bitte neu beginnen.' }, { status: 400 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: 'Der KI-Assistent ist falsch eingerichtet (API-Schlüssel ungültig).' }, { status: 503 });
    return NextResponse.json({ error: 'Der Assistent ist gerade nicht erreichbar. Bitte erneut versuchen.' }, { status: 502 });
  }
}
