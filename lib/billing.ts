'use client';

import { getSupabase, supabaseConfigured } from './db/supabase';

export type BillingInfo = { enabled: boolean; prices: Record<'business' | 'team', { monthly: boolean; yearly: boolean }> };

export async function billingInfo(): Promise<BillingInfo> {
  try {
    return await (await fetch('/api/billing', { cache: 'no-store' })).json();
  } catch {
    return { enabled: false, prices: { business: { monthly: false, yearly: false }, team: { monthly: false, yearly: false } } };
  }
}

async function call(path: string, body: unknown): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Anfrage fehlgeschlagen.');
  return json;
}

export const startCheckout = (companyId: string, plan: 'business' | 'team', interval: 'monthly' | 'yearly') => call('/api/billing/checkout', { companyId, plan, interval });
export const openPortal = (companyId: string) => call('/api/billing/portal', { companyId });
export const syncBilling = (companyId: string) => call('/api/billing/sync', { companyId });
