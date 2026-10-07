import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Prüft das Supabase-Zugriffstoken aus dem Authorization-Header. */
export async function userFromRequest(req: Request): Promise<{ id: string; email: string } | null> {
  if (!url || !anonKey) return null;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id, email: data.user.email || '' };
}

let admin: SupabaseClient | null = null;
/**
 * Datenbankzugriff mit dem geheimen Schlüssel (SUPABASE_SERVICE_ROLE_KEY bzw. sb_secret_…).
 * Nur serverseitig verwenden – umgeht Row Level Security.
 */
export function adminDb(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Rolle des Nutzers in der Firma (owner/admin/member) oder null. */
export async function memberRole(companyId: string, userId: string): Promise<string | null> {
  const { data } = await adminDb().from('company_members').select('role').eq('company_id', companyId).eq('user_id', userId).maybeSingle();
  return (data?.role as string) || null;
}

/** Datenbankzugriff im Namen des angemeldeten Nutzers (Row Level Security bleibt aktiv). */
export function userDb(req: Request): SupabaseClient {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
