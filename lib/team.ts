'use client';

import { getSupabase } from './db/supabase';

export type Role = 'owner' | 'admin' | 'member';

export const ROLE_LABEL: Record<Role, string> = { owner: 'Inhaber', admin: 'Admin', member: 'Mitarbeiter' };
export const ROLE_HINT: Record<Role, string> = {
  owner: 'Alle Rechte, inkl. Tarif und Löschen der Firma',
  admin: 'Alle Rechte inkl. Firmendaten, Tarif und Team – außer Rollen ändern',
  member: 'Angebote, Rechnungen, Kunden, Material und Buchungen – keine Einstellungen',
};

/** Seiten, die nur Inhaber und Admins öffnen dürfen. */
export const ADMIN_PATHS = ['/app/firma', '/app/design', '/app/einstellungen', '/app/tarif'];
export const isAdminRole = (role: string | null | undefined) => role === 'owner' || role === 'admin';

export type TeamEntry = {
  kind: 'member' | 'invite';
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  token: string;
  isMe: boolean;
};

export type InviteInfo = { companyName: string; email: string; role: Role; expired: boolean; accepted: boolean };

const PENDING_KEY = 'vysn-pending-invite';
export const pendingInvite = () => { try { return localStorage.getItem(PENDING_KEY) || ''; } catch { return ''; } };
export const setPendingInvite = (token: string) => { try { if (token) localStorage.setItem(PENDING_KEY, token); else localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };

export const inviteLink = (token: string) => `${window.location.origin}/app/einladung?token=${token}`;

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchTeam(companyId: string): Promise<TeamEntry[]> {
  const rows = check(await getSupabase().rpc('company_team', { p_company: companyId })) as Record<string, unknown>[] | null;
  return (rows || []).map((r) => ({
    kind: r.kind === 'invite' ? 'invite' : 'member',
    id: String(r.id),
    email: String(r.email ?? ''),
    role: r.role as Role,
    createdAt: String(r.created_at ?? ''),
    expiresAt: String(r.expires_at ?? ''),
    token: String(r.token ?? ''),
    isMe: !!r.is_me,
  }));
}

export const inviteMember = async (companyId: string, email: string, role: 'admin' | 'member') =>
  String(check(await getSupabase().rpc('invite_member', { p_company: companyId, p_email: email, p_role: role })));
export const revokeInvite = async (inviteId: string) => { check(await getSupabase().rpc('revoke_invite', { p_invite: inviteId })); };
export const setMemberRole = async (companyId: string, userId: string, role: 'admin' | 'member') => {
  check(await getSupabase().rpc('set_member_role', { p_company: companyId, p_user: userId, p_role: role }));
};
export const removeMember = async (companyId: string, userId: string) => {
  check(await getSupabase().rpc('remove_member', { p_company: companyId, p_user: userId }));
};

export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  const rows = check(await getSupabase().rpc('invite_info', { p_token: token })) as Record<string, unknown>[] | null;
  const r = rows?.[0];
  return r ? { companyName: String(r.company_name), email: String(r.email), role: r.role as Role, expired: !!r.expired, accepted: !!r.accepted } : null;
}

export const acceptInvite = async (token: string) => String(check(await getSupabase().rpc('accept_invite', { p_token: token })));

/** Schickt den Einladungslink per E-Mail (nur mit eingerichtetem SMTP). */
export async function mailInvite(token: string) {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch('/api/team/invite-mail', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify({ token }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'E-Mail konnte nicht versendet werden.');
}
