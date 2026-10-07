import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { PlanId } from '../../../lib/types';
import { hasFeature } from '../../../lib/plans';
import { agentTurn } from '../../../lib/server/agent';
import { adminDb, memberRole, userDb, userFromRequest } from '../../../lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_HISTORY_CHARS = 400_000;

/** Anfragen je Firma und Tag (Kostenschutz), über AI_DAILY_LIMIT anpassbar. */
const dailyLimit = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30);

/** Ist der Assistent eingerichtet? Ohne API-Schlüssel blendet die App ihn aus. */
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.ANTHROPIC_API_KEY, dailyLimit: dailyLimit() });
}

/** KI-Sprachassistent (Business & Team): ein Gesprächsschritt. */
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

  const { data: company } = await adminDb().from('companies').select('name, plan, default_vat, small_business, country').eq('id', companyId).single();
  if (!company || !hasFeature(company.plan as PlanId, 'ai')) {
    return NextResponse.json({ error: 'Der KI-Sprachassistent ist ab dem Tarif Business enthalten.', upgrade: 'ai' }, { status: 402 });
  }
  // Tageslimit: erst zählen, dann fragen – ohne Zähler (SQL fehlt) lieber gar nicht
  const { data: remaining, error: limitError } = await adminDb().rpc('ai_take', { p_company: companyId, p_limit: dailyLimit() });
  if (limitError) {
    console.error('ai_take', limitError);
    return NextResponse.json({ error: 'Der KI-Assistent ist noch nicht vollständig eingerichtet (Tageslimit fehlt).' }, { status: 503 });
  }
  if (remaining < 0) {
    return NextResponse.json({ error: `Das Tageslimit von ${dailyLimit()} Anfragen ist für heute erreicht. Morgen geht es weiter.` }, { status: 429 });
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
