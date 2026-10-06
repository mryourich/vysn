-- Lagerplätze (QR-Etiketten), Einnahmen, E-Mail-Versand, Einstellungen (DATEV, E-Mail)

-- Einstellungen je Firma (DATEV-Konten, E-Mail-Vorlagen)
alter table public.companies add column if not exists settings jsonb not null default '{}'::jsonb;
grant update (settings) on public.companies to authenticated;

-- Lagerplätze
create table if not exists public.storage_locations (
  company_id uuid not null references public.companies (id) on delete cascade,
  id         text not null,
  code       text not null,
  name       text not null default '',
  note       text not null default '',
  primary key (company_id, id),
  unique (company_id, code)
);
alter table public.storage_locations enable row level security;
create policy storage_locations_all on public.storage_locations for all to authenticated
  using (public.is_member(company_id)) with check (public.is_member(company_id));
grant select, insert, update, delete on public.storage_locations to authenticated;

alter table public.materials add column if not exists location_id text;
alter table public.materials add constraint materials_location_fk
  foreign key (company_id, location_id) references public.storage_locations (company_id, id) on delete set null (location_id);

-- Einnahmen ohne Rechnung liegen in derselben Tabelle wie Ausgaben
alter table public.expenses add column if not exists kind text not null default 'expense' check (kind in ('expense', 'income'));

-- Versandprotokoll der Belege
alter table public.documents add column if not exists sent_at timestamptz;
alter table public.documents add column if not exists sent_to text not null default '';

-- sent_at/sent_to dürfen auch bei festgeschriebenen Rechnungen gesetzt werden:
-- protect_issued_invoices() prüft nur Inhaltsfelder, daher keine Anpassung nötig.
