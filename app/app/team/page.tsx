'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Info, LogOut, Mail, Send, ShieldCheck, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { formatDate } from '../../../lib/calc';
import { mailStatus } from '../../../lib/mail';
import { PLAN_USERS } from '../../../lib/plans';
import { useStore } from '../../../lib/store';
import {
  ROLE_HINT, ROLE_LABEL, fetchTeam, inviteLink, inviteMember, isAdminRole, mailInvite, removeMember, revokeInvite, setMemberRole,
} from '../../../lib/team';
import type { Role, TeamEntry } from '../../../lib/team';
import { Badge, Field, PageHeader } from '../../../components/app/ui';

export default function TeamPage() {
  const { data, auth, role, activeCompanyId, switchCompany } = useStore();
  const router = useRouter();
  const company = data.company!;
  const admin = isAdminRole(role);
  const teamPlan = company.plan === 'team';
  const seats = PLAN_USERS[company.plan];

  const [team, setTeam] = useState<TeamEntry[] | null>(null);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<'member' | 'admin'>('member');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState<{ email: string; token: string } | null>(null);
  const [mailEnabled, setMailEnabled] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!activeCompanyId || auth.mode !== 'supabase') return;
    try {
      setTeam(await fetchTeam(activeCompanyId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeCompanyId, auth.mode]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { mailStatus().then((s) => setMailEnabled(s.enabled)); }, []);

  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await fn();
      if (done) setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(token);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Einladungslink kopieren:', inviteLink(token));
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    run('invite', async () => {
      const token = await inviteMember(activeCompanyId!, address, newRole);
      setCreated({ email: address, token });
      setEmail('');
      if (mailEnabled) {
        try {
          await mailInvite(token);
          setNotice(`Einladung an ${address} versendet.`);
        } catch (err) {
          setError(`Einladung erstellt, aber die E-Mail konnte nicht versendet werden: ${(err as Error).message} Teilen Sie den Link unten selbst.`);
        }
      }
    });
  };

  if (auth.mode !== 'supabase') {
    return (
      <div className="page">
        <PageHeader title="Team & Rechte" />
        <div className="notice notice-warn"><Info size={16} /><span>Mitarbeitende einladen ist nur mit Konto möglich. Diese Installation läuft im lokalen Modus ohne Anmeldung.</span></div>
      </div>
    );
  }

  const members = (team || []).filter((t) => t.kind === 'member');
  const invites = (team || []).filter((t) => t.kind === 'invite' && new Date(t.expiresAt) > new Date());
  const expired = (team || []).filter((t) => t.kind === 'invite' && new Date(t.expiresAt) <= new Date());
  const used = members.length + invites.length;
  const full = used >= seats;
  const me = members.find((m) => m.isMe);

  const canRemove = (m: TeamEntry) => m.role !== 'owner' && !m.isMe && (role === 'owner' || (role === 'admin' && m.role === 'member'));

  return (
    <div className="page">
      <PageHeader title="Team & Rechte" description={`Wer in „${company.name}“ mitarbeitet und was die einzelnen Personen dürfen.`} />

      {notice ? <div className="notice notice-ok" role="status"><Check size={16} /><span>{notice}</span></div> : null}
      {error ? <div className="notice notice-warn" role="alert"><Info size={16} /><span>{error}</span></div> : null}

      {admin && !teamPlan ? (
        <section className="card team-upsell">
          <div className="empty-icon"><UserPlus size={22} /></div>
          <div>
            <h3>Gemeinsam arbeiten mit dem Tarif Team</h3>
            <p className="muted">Laden Sie bis zu {PLAN_USERS.team} Personen ein – mit Rollen für Inhaber, Admins und Mitarbeiter. {members.length > 1 ? 'Bisherige Mitglieder erhalten nach der Buchung automatisch wieder Zugriff.' : ''}</p>
          </div>
          <Link href="/app/tarif" className="btn btn-primary"><Sparkles size={16} /> Tarif Team ansehen</Link>
        </section>
      ) : null}

      {admin && teamPlan ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Person einladen</h3>
              <p className="muted small">Die Person erhält einen Link und meldet sich mit genau dieser E-Mail-Adresse an oder registriert sich kostenlos.</p>
            </div>
            <span className="seat-count"><strong>{used}</strong> von {seats} Plätzen</span>
          </div>
          <div className="quota-bar"><i style={{ width: `${Math.min(100, (used / seats) * 100)}%` }} className={full ? 'full' : ''} /></div>
          <form className="invite-form" onSubmit={invite}>
            <Field label="E-Mail-Adresse"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.de" disabled={full} /></Field>
            <Field label="Rolle">
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'member' | 'admin')} disabled={full}>
                <option value="member">{ROLE_LABEL.member}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </select>
            </Field>
            <button type="submit" className="btn btn-primary" disabled={full || !!busy}><UserPlus size={16} /> {busy === 'invite' ? 'Einladen …' : 'Einladen'}</button>
          </form>
          {full ? <p className="muted small">Alle Plätze sind belegt. Entfernen Sie eine Person oder ziehen Sie eine Einladung zurück.</p> : null}
          {created ? (
            <div className="invite-link">
              <span className="small"><strong>Einladungslink für {created.email}</strong> – gültig 14 Tage, nur einmal verwendbar:</span>
              <div className="invite-link-row">
                <input readOnly value={inviteLink(created.token)} onFocus={(e) => e.target.select()} aria-label="Einladungslink" />
                <button type="button" className="btn" onClick={() => copy(created.token)}>{copied === created.token ? <><Check size={16} /> Kopiert</> : <><Copy size={16} /> Kopieren</>}</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <div className="card-head"><h3>Mitglieder</h3></div>
        {!team ? <p className="muted">Lädt …</p> : (
          <ul className="team-list">
            {members.map((m) => (
              <li key={m.id}>
                <span className="team-avatar">{(m.email || '?').slice(0, 1).toUpperCase()}</span>
                <div className="team-who">
                  <strong>{m.email || 'Unbekannt'}{m.isMe ? <span className="muted"> (Sie)</span> : null}</strong>
                  <small className="muted">Dabei seit {formatDate(m.createdAt.slice(0, 10))}</small>
                </div>
                <div className="team-actions">
                  {role === 'owner' && m.role !== 'owner' ? (
                    <select value={m.role} aria-label={`Rolle von ${m.email}`} disabled={!!busy}
                      onChange={(e) => run(`role-${m.id}`, () => setMemberRole(activeCompanyId!, m.id, e.target.value as 'admin' | 'member'), 'Rolle geändert.')}>
                      <option value="member">{ROLE_LABEL.member}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                    </select>
                  ) : <Badge tone={m.role === 'owner' ? 'info' : 'neutral'}>{ROLE_LABEL[m.role]}</Badge>}
                  {canRemove(m) ? (
                    <button className="icon-btn" title="Entfernen" aria-label={`${m.email} entfernen`} disabled={!!busy}
                      onClick={() => confirm(`${m.email} aus „${company.name}“ entfernen? Die Person verliert sofort den Zugriff.`) && run(`rm-${m.id}`, () => removeMember(activeCompanyId!, m.id), 'Person entfernt.')}>
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {admin ? invites.map((i) => (
              <li key={i.id} className="team-invite">
                <span className="team-avatar pending"><Mail size={15} /></span>
                <div className="team-who">
                  <strong>{i.email}</strong>
                  <small className="muted">Eingeladen · gültig bis {formatDate(i.expiresAt.slice(0, 10))}</small>
                </div>
                <div className="team-actions">
                  <Badge tone="warning">{ROLE_LABEL[i.role]} · offen</Badge>
                  <button className="icon-btn" title="Link kopieren" aria-label={`Link für ${i.email} kopieren`} onClick={() => copy(i.token)}>{copied === i.token ? <Check size={16} /> : <Copy size={16} />}</button>
                  {mailEnabled ? (
                    <button className="icon-btn" title="Erneut per E-Mail senden" aria-label={`Einladung an ${i.email} erneut senden`} disabled={!!busy}
                      onClick={() => run(`mail-${i.id}`, () => mailInvite(i.token), `Einladung an ${i.email} erneut versendet.`)}><Send size={16} /></button>
                  ) : null}
                  <button className="icon-btn" title="Einladung zurückziehen" aria-label={`Einladung an ${i.email} zurückziehen`} disabled={!!busy}
                    onClick={() => run(`revoke-${i.id}`, () => revokeInvite(i.id), 'Einladung zurückgezogen.')}><Trash2 size={16} /></button>
                </div>
              </li>
            )) : null}
            {admin ? expired.map((i) => (
              <li key={i.id} className="team-invite">
                <span className="team-avatar pending"><Mail size={15} /></span>
                <div className="team-who">
                  <strong>{i.email}</strong>
                  <small className="muted">Einladung abgelaufen</small>
                </div>
                <div className="team-actions">
                  {teamPlan && !full ? <button className="btn btn-small" disabled={!!busy} onClick={() => run(`renew-${i.id}`, async () => {
                    const token = await inviteMember(activeCompanyId!, i.email, i.role as 'admin' | 'member');
                    setCreated({ email: i.email, token });
                    if (mailEnabled) await mailInvite(token);
                  }, 'Einladung erneuert.')}>Erneut einladen</button> : null}
                  <button className="icon-btn" title="Entfernen" aria-label={`Abgelaufene Einladung an ${i.email} entfernen`} disabled={!!busy}
                    onClick={() => run(`revoke-${i.id}`, () => revokeInvite(i.id))}><Trash2 size={16} /></button>
                </div>
              </li>
            )) : null}
          </ul>
        )}
        {me && me.role !== 'owner' ? (
          <div className="team-leave">
            <button className="btn btn-quiet" disabled={!!busy} onClick={async () => {
              if (!confirm(`„${company.name}“ verlassen? Sie verlieren den Zugriff auf alle Daten dieser Firma.`)) return;
              if (!(await run('leave', () => removeMember(activeCompanyId!, me.id)))) return;
              await switchCompany('');
              router.push('/app');
            }}><LogOut size={16} /> Firma verlassen</button>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="card-head"><h3>Rollen</h3></div>
        <ul className="role-list">
          {(['owner', 'admin', 'member'] as Role[]).map((r) => (
            <li key={r}><ShieldCheck size={16} /><span><strong>{ROLE_LABEL[r]}</strong> – {ROLE_HINT[r]}</span></li>
          ))}
        </ul>
        <p className="muted small">Endet der Tarif Team, behält nur der Inhaber Zugriff. Die übrigen Mitglieder bleiben gespeichert und können nach erneuter Buchung sofort weiterarbeiten.</p>
      </section>
    </div>
  );
}
