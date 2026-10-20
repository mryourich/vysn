'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Camera, HardHat, Plus, Search, TriangleAlert } from 'lucide-react';
import { money, qty } from '../../../lib/calc';
import { getSupabase, supabaseConfigured } from '../../../lib/db/supabase';
import { listEntries, listProjects, projectSummary } from '../../../lib/projects';
import type { Project, ProjectEntry } from '../../../lib/projects';
import { useStore } from '../../../lib/store';
import { Badge, Empty, PageHeader, Segmented, StatCard, useCreateAction } from '../../../components/app/ui';
import { ProjectModal } from '../../../components/app/project-modal';

export default function ProjectsPage() {
  const { data, activeCompanyId, auth } = useStore();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active');
  const [q, setQ] = useState('');
  useCreateAction(() => setCreating(true));
  const online = supabaseConfigured && auth.mode === 'supabase' && !!activeCompanyId;

  const load = useCallback(async () => {
    if (!online) return;
    try {
      const db = getSupabase();
      const [p, e] = await Promise.all([listProjects(db, activeCompanyId!), listEntries(db, activeCompanyId!)]);
      setProjects(p);
      setEntries(e);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setProjects([]);
    }
  }, [online, activeCompanyId]);
  useEffect(() => { load(); }, [load]);

  const byProject = (id: string) => entries.filter((e) => e.projectId === id);
  const customerName = (id: string) => data.customers.find((c) => c.id === id)?.name || '';
  const list = (projects || [])
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => !q || `${p.name} ${p.number} ${p.city} ${customerName(p.customerId)}`.toLowerCase().includes(q.toLowerCase()));
  const active = (projects || []).filter((p) => p.status === 'active');
  const totals = projectSummary(entries.filter((e) => active.some((p) => p.id === e.projectId)));

  return (
    <div className="page">
      <PageHeader title="Baustellen" description="Regiestunden, Material, Fotos und Mängel je Baustelle – und daraus mit einem Klick die Rechnung."
        actions={online ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Neue Baustelle</button> : null} />

      {!online ? (
        <section className="card"><Empty icon={<HardHat />} title="Baustellen brauchen ein Konto" text="Melden Sie sich an – dann erfassen Sie Stunden, Material und Fotos auf der Baustelle am Handy und rechnen im Büro ab." /></section>
      ) : (
        <>
          {error ? <div className="notice notice-warn" role="alert"><TriangleAlert size={16} /><span>{error}</span></div> : null}
          <div className="stats">
            <StatCard label="Laufende Baustellen" value={String(active.length)} />
            <StatCard label="Offene Regiestunden" value={`${qty(totals.openHours)} Std.`} sub="noch nicht abgerechnet" />
            <StatCard label="Noch abzurechnen" value={money(totals.openValue)} sub="netto, Stunden + Material" tone={totals.openValue ? 'success' : undefined} />
            <StatCard label="Offene Mängel" value={String(totals.openDefects)} tone={totals.openDefects ? 'warning' : undefined} />
          </div>
          <section className="card">
            <div className="toolbar">
              <Segmented value={filter} options={[['active', 'Laufend'], ['done', 'Abgeschlossen'], ['all', 'Alle']]} onChange={setFilter} />
              <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Baustelle, Kunde, Ort …" /></label>
            </div>
            {projects === null ? <p className="muted pad">Lädt …</p> : list.length ? (
              <div className="table">
                <div className="tr th tr-proj"><span>Baustelle</span><span className="hide-sm">Kunde</span><span className="td-num">Offen</span><span className="td-num hide-sm">Fotos / Mängel</span></div>
                {list.map((p) => {
                  const s = projectSummary(byProject(p.id));
                  return (
                    <a key={p.id} href={`/app/baustellen/ansehen?id=${p.id}`} className="tr tr-proj" onClick={(e) => { e.preventDefault(); router.push(`/app/baustellen/ansehen?id=${p.id}`); }}>
                      <span className="td-main"><HardHat size={16} /><span><strong>{p.name}</strong><small>{p.number}{p.city ? ` · ${[p.zip, p.city].filter(Boolean).join(' ')}` : ''}{p.status === 'done' ? ' · abgeschlossen' : ''}</small></span></span>
                      <span className="td-muted hide-sm">{customerName(p.customerId) || '—'}</span>
                      <span className="td-num">{s.openValue ? money(s.openValue) : <span className="td-muted">—</span>}<small className="block muted">{s.openHours ? `${qty(s.openHours)} Std.` : ''}</small></span>
                      <span className="td-num hide-sm"><Camera size={13} className="inline-icon" /> {s.photos} · {s.openDefects ? <Badge tone="warning">{s.openDefects} offen</Badge> : '0'}</span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <Empty icon={<HardHat />} title={projects.length ? 'Keine Treffer' : 'Noch keine Baustellen'}
                text={projects.length ? 'Für diesen Filter gibt es keine Baustelle.' : 'Legen Sie eine Baustelle an. Ihre Leute tragen Regiestunden, Material und Fotos direkt vor Ort ein – Sie machen daraus im Büro die Rechnung.'}
                action={projects.length ? undefined : <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Baustelle anlegen</button>} />
            )}
          </section>
        </>
      )}

      {creating ? (
        <ProjectModal onClose={() => setCreating(false)} onSaved={(p) => { setCreating(false); router.push(`/app/baustellen/ansehen?id=${p.id}`); }} />
      ) : null}
    </div>
  );
}
