'use client';

import { getSupabase, supabaseConfigured } from './db/supabase';
import type { PaidPlan, PlanId } from './types';

export type BillingInfo = { enabled: boolean; prices: Partial<Record<PaidPlan, { monthly: boolean; yearly: boolean }>> };

export async function billingInfo(): Promise<BillingInfo> {
  try {
    return await (await fetch('/api/billing', { cache: 'no-store' })).json();
  } catch {
    return { enabled: false, prices: {} };
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

export const startCheckout = (companyId: string, plan: PaidPlan, interval: 'monthly' | 'yearly') => call('/api/billing/checkout', { companyId, plan, interval });
export type ChangeResult = { mode: 'now' | 'scheduled' | 'unchanged'; plan: string; interval: string | null; at: string | null };
export const changePlan = (companyId: string, plan: PlanId, interval: 'monthly' | 'yearly') =>
  call('/api/billing/change', { companyId, plan, interval }) as unknown as Promise<ChangeResult>;
export async function withdrawalInfo(companyId: string): Promise<{ eligible: boolean; until?: string }> {
  const headers: Record<string, string> = {};
  if (supabaseConfigured) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }
  try {
    const res = await fetch(`/api/billing/withdraw?companyId=${encodeURIComponent(companyId)}`, { headers, cache: 'no-store' });
    return res.ok ? await res.json() : { eligible: false };
  } catch {
    return { eligible: false };
  }
}
export const withdraw = (companyId: string, name: string) =>
  call('/api/billing/withdraw', { companyId, name }) as unknown as Promise<{ ok: boolean; refunded: number; currency: string; mailed: boolean }>;
export const openPortal = (companyId: string) => call('/api/billing/portal', { companyId });
export const syncBilling = (companyId: string) => call('/api/billing/sync', { companyId });

/** KI-Sprachassistent (Zusatzbuchung, eigenes Abo) */
export type AiAction = 'checkout' | 'portal' | 'cancel' | 'resume' | 'sync';
export const aiBilling = (companyId: string, action: AiAction) => call('/api/billing/ai', { companyId, action });
export const aiWithdrawalInfo = (companyId: string) =>
  (call('/api/billing/ai', { companyId, action: 'withdraw-info' }) as unknown as Promise<{ eligible: boolean; until?: string }>).catch(() => ({ eligible: false } as { eligible: boolean; until?: string }));
export const aiWithdraw = (companyId: string, name: string) =>
  call('/api/billing/ai', { companyId, action: 'withdraw', name }) as unknown as Promise<{ ok: boolean; refunded: number; currency: string; mailed: boolean }>;
