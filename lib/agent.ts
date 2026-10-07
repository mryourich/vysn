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
  items: { material_id: string; description: string; details: string; quantity: number; unit: string; unit_price: number; vat: number }[];
};

export type AgentResult = { messages: AgentHistory; reply: string; proposal: AgentProposal | null; remaining?: number };

export type AgentStatus = { enabled: boolean; dailyLimit: number };

let statusPromise: Promise<AgentStatus> | null = null;

/** Ob der Assistent auf dem Server eingerichtet ist (API-Schlüssel vorhanden) – einmal je Sitzung abgefragt. */
export function agentStatus(): Promise<AgentStatus> {
  statusPromise ??= fetch('/api/agent')
    .then((r) => (r.ok ? r.json() : { enabled: false, dailyLimit: 0 }))
    .catch(() => { statusPromise = null; return { enabled: false, dailyLimit: 0 }; });
  return statusPromise;
}

export class AgentError extends Error {
  constructor(message: string, readonly upgrade?: string) { super(message); }
}

export async function askAgent(companyId: string, history: AgentHistory, text: string): Promise<AgentResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch('/api/agent', { method: 'POST', headers, body: JSON.stringify({ companyId, history, text }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new AgentError(json.error || 'Der Assistent ist gerade nicht erreichbar.', json.upgrade);
  return json as AgentResult;
}
