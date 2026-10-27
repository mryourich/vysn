'use client';

import { getSupabase, supabaseConfigured } from './db/supabase';
import type { DocKind } from './types';

/** Gesprächsverlauf mit dem KI-Assistenten (Format der Claude-API, unverändert zurückgeben). */
export type AgentHistory = unknown[];

export type AgentProposal = {
  kind: DocKind;
  customer_id: string;
  recipient_name: string;
  subject: string;
  items: { material_id: string; description: string; details: string; quantity: number; unit: string; unit_price: number; vat: number; monthly?: boolean }[];
};

export type EmailProposal = { to: string; customer_id: string; subject: string; text: string; document_id: string; in_reply_to: string; purpose: string };
export type CustomerProposal = { customer_id: string; name: string; contact_person: string; email: string; phone: string; street: string; zip: string; city: string; notes: string };
export type PaymentProposal = { document_id: string; paid_date: string };

/** Vorschläge des Assistenten – ausgeführt wird erst nach Bestätigung */
export type AgentAction =
  | ({ type: 'document' } & AgentProposal)
  | ({ type: 'email' } & EmailProposal)
  | ({ type: 'customer' } & CustomerProposal)
  | ({ type: 'payment' } & PaymentProposal);

/** remaining = übrige Aufgaben im laufenden Monat */
export type AgentResult = { messages: AgentHistory; reply: string; actions?: AgentAction[]; proposal: AgentProposal | null; remaining?: number };

export type AgentStatus = { enabled: boolean; dailyLimit: number; monthlyLimit?: number; remaining?: number };

let statusPromise: Promise<AgentStatus> | null = null;

/** Ob der Assistent auf dem Server eingerichtet ist (API-Schlüssel vorhanden) – einmal je Sitzung abgefragt. */
export function agentStatus(): Promise<AgentStatus> {
  statusPromise ??= fetch('/api/agent')
    .then((r) => (r.ok ? r.json() : { enabled: false, dailyLimit: 0 }))
    .catch(() => { statusPromise = null; return { enabled: false, dailyLimit: 0 }; });
  return statusPromise;
}

/** Übrige Aufgaben der Firma im laufenden Monat */
export async function agentRemaining(companyId: string): Promise<number | null> {
  const headers: Record<string, string> = {};
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) { headers.authorization = `Bearer ${data.session.access_token}`; headers['x-vysn-token'] = data.session.access_token; }
  }
  const json = await fetch(`/api/agent?companyId=${encodeURIComponent(companyId)}`, { headers }).then((r) => r.json()).catch(() => ({}));
  return typeof json.remaining === 'number' ? json.remaining : null;
}

export class AgentError extends Error {
  constructor(message: string, readonly upgrade?: string) { super(message); }
}

export type AgentEvent = { type: 'status'; text: string } | { type: 'delta'; text: string } | { type: 'step' };

/** Ein Gesprächsschritt; mit onEvent kommen Status und Antworttext live (Datenstrom). */
export async function askAgent(companyId: string, history: AgentHistory, text: string, onEvent?: (e: AgentEvent) => void): Promise<AgentResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) { headers.authorization = `Bearer ${data.session.access_token}`; headers['x-vysn-token'] = data.session.access_token; }
  }
  const res = await fetch('/api/agent', { method: 'POST', headers, body: JSON.stringify({ companyId, history, text, stream: !!onEvent }) });
  if (!res.ok || !onEvent || !res.body || !(res.headers.get('content-type') || '').includes('ndjson')) {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new AgentError(json.error || 'Der Assistent ist gerade nicht erreichbar.', json.upgrade);
    return json as AgentResult;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.type === 'done') return msg as AgentResult;
      if (msg.type === 'error') throw new AgentError(msg.error || 'Der Assistent ist gerade nicht erreichbar.');
      onEvent(msg as AgentEvent);
    }
    if (done) throw new AgentError('Die Verbindung wurde unterbrochen. Bitte erneut versuchen.');
  }
}
