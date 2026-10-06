-- VYSN One – komplette Datenbank-Einrichtung für Supabase
-- Enthält alle Migrationen aus supabase/migrations/ in der richtigen Reihenfolge.
-- Einmal komplett im Supabase SQL Editor ausführen (New query → einfügen → Run).


-- ====================================================================
-- 20260930120000_init.sql
-- ====================================================================
-- VYSN One – Datenbankschema für Supabase (PostgreSQL 15+)
--
-- Mandantenmodell: Jede Firma (companies) hat Mitglieder (company_members).
-- Alle Geschäftsdaten tragen company_id; Row Level Security erlaubt Zugriff
-- nur für Mitglieder der jeweiligen Firma.
-- IDs der Geschäftsdaten werden im Client erzeugt (text), damit Offline-/Import-
-- Daten ohne Umschlüsselung übernommen werden können. Primärschlüssel ist
-- daher (company_id, id).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Firmen & Mitglieder
-- ---------------------------------------------------------------------------
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  plan                text not null default 'start' check (plan in ('start', 'business', 'team')),
  name                text not null,
  owner               text not null default '',
  street              text not null default '',
  zip                 text not null default '',
  city                text not null default '',
  country             text not null default 'Deutschland',
  email               text not null default '',
  phone               text not null default '',
  website             text not null default '',
  tax_number          text not null default '',
  vat_id              text not null default '',
  register_court      text not null default '',
  register_number     text not null default '',
  bank_name           text not null default '',
  iban                text not null default '',
  bic                 text not null default '',
  logo                text not null default '',          -- Data-URL (PNG); später ggf. Supabase Storage
  logo_ratio          numeric not null default 1,
  small_business      boolean not null default false,
  default_vat         numeric(5,2) not null default 19,
  payment_term_days   integer not null default 14,
  offer_validity_days integer not null default 30,
  invoice_prefix      text not null default 'RE',
  offer_prefix        text not null default 'AN',
  design              jsonb not null default '{}'::jsonb  -- Rechnungsdesign (InvoiceDesign)
);

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

-- ---------------------------------------------------------------------------
-- Stammdaten
-- ---------------------------------------------------------------------------
create table public.customers (
  company_id     uuid not null references public.companies (id) on delete cascade,
  id             text not null,
  number         text not null default '',
  name           text not null,
  contact_person text not null default '',
  street         text not null default '',
  zip            text not null default '',
  city           text not null default '',
  country        text not null default 'Deutschland',
  email          text not null default '',
  phone          text not null default '',
  vat_id         text not null default '',
  notes          text not null default '',
  created_at     date,
  primary key (company_id, id)
);

create table public.materials (
  company_id     uuid not null references public.companies (id) on delete cascade,
  id             text not null,
  number         text not null default '',
  name           text not null,
  description    text not null default '',
  category       text not null default '',
  unit           text not null default 'Stück',
  purchase_price numeric(12,2) not null default 0,
  sale_price     numeric(12,2) not null default 0,
  vat            numeric(5,2) not null default 19,
  stock          numeric(14,3) not null default 0,
  min_stock      numeric(14,3) not null default 0,
  primary key (company_id, id)
);

create table public.stock_movements (
  company_id  uuid not null,
  id          text not null,
  material_id text not null,
  date        date not null,
  quantity    numeric(14,3) not null,
  note        text not null default '',
  primary key (company_id, id),
  foreign key (company_id, material_id) references public.materials (company_id, id) on delete cascade
);
create index stock_movements_material_idx on public.stock_movements (company_id, material_id, date desc);

-- ---------------------------------------------------------------------------
-- Belege (Angebote & Rechnungen)
-- Empfänger und Positionen werden als Snapshot (jsonb) gespeichert: Eine
-- festgeschriebene Rechnung darf sich nicht ändern, wenn Kunde oder Artikel
-- später bearbeitet werden.
-- ---------------------------------------------------------------------------
create table public.documents (
  company_id   uuid not null references public.companies (id) on delete cascade,
  id           text not null,
  kind         text not null check (kind in ('offer', 'invoice')),
  number       text not null,
  status       text not null check (status in ('draft', 'sent', 'accepted', 'declined', 'paid', 'cancelled')),
  customer_id  text,
  recipient    jsonb not null default '{}'::jsonb,
  subject      text not null default '',
  date         date not null,
  due_date     date,
  service_date text not null default '',
  intro        text not null default '',
  outro        text not null default '',
  items        jsonb not null default '[]'::jsonb,
  paid_date    date,
  source_id    text not null default '',
  stock_booked boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (company_id, id),
  unique (company_id, kind, number),
  foreign key (company_id, customer_id) references public.customers (company_id, id) on delete set null (customer_id)
);
create index documents_date_idx on public.documents (company_id, kind, date desc);

create table public.expenses (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  date        date not null,
  supplier    text not null default '',
  description text not null default '',
  category    text not null,
  net         numeric(12,2) not null default 0,
  vat         numeric(5,2) not null default 19,
  receipt_no  text not null default '',
  primary key (company_id, id)
);
create index expenses_date_idx on public.expenses (company_id, date desc);

-- Nummernkreise: key = 'invoice:2026', 'offer:2026', 'customer', 'material'
create table public.number_counters (
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null,
  last_number integer not null default 0,
  primary key (company_id, key)
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Festgeschriebene Rechnungen (Status ≠ Entwurf) sind inhaltlich unveränderbar (GoBD).
-- Erlaubt bleiben Statuswechsel (bezahlt, storniert), Zahlungsdatum und Lagerkennzeichen.
create or replace function public.protect_issued_invoices() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    -- Löschen der gesamten Firma (Kaskade) bleibt dem Inhaber möglich.
    if old.kind = 'invoice' and old.status <> 'draft'
       and exists (select 1 from public.companies c where c.id = old.company_id) then
      raise exception 'Festgeschriebene Rechnung % kann nicht gelöscht werden', old.number using errcode = '42501';
    end if;
    return old;
  end if;
  if old.kind = 'invoice' and old.status <> 'draft' and (
       new.number is distinct from old.number or new.date is distinct from old.date
    or new.items is distinct from old.items or new.recipient is distinct from old.recipient
    or new.due_date is distinct from old.due_date or new.service_date is distinct from old.service_date
    or new.kind is distinct from old.kind or new.status = 'draft'
  ) then
    raise exception 'Festgeschriebene Rechnung % kann nicht geändert werden', old.number using errcode = '42501';
  end if;
  return new;
end $$;

create trigger documents_protect before update or delete on public.documents
  for each row execute function public.protect_issued_invoices();

create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------
create or replace function public.is_member(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m where m.company_id = p_company and m.user_id = auth.uid());
$$;

create or replace function public.is_owner(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m where m.company_id = p_company and m.user_id = auth.uid() and m.role = 'owner');
$$;

-- Legt eine Firma an und macht den aufrufenden Nutzer zum Inhaber.
create or replace function public.create_company(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.companies (name) values (coalesce(nullif(trim(p_name), ''), 'Meine Firma')) returning id into v_id;
  insert into public.company_members (company_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- Vergibt atomar die nächste Nummer eines Nummernkreises (keine Doppelvergabe bei mehreren Nutzern).
create or replace function public.allocate_number(p_company uuid, p_key text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_next integer;
begin
  if not public.is_member(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.number_counters as c (company_id, key, last_number)
  values (p_company, p_key, 1)
  on conflict (company_id, key) do update set last_number = c.last_number + 1
  returning last_number into v_next;
  return v_next;
end $$;

-- Hebt Zähler auf mindestens die übergebenen Werte an (z. B. nach Datenimport).
create or replace function public.bump_counters(p_company uuid, p_counters jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_member(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for r in select key, value from jsonb_each_text(p_counters) loop
    insert into public.number_counters as c (company_id, key, last_number)
    values (p_company, r.key, r.value::integer)
    on conflict (company_id, key) do update set last_number = greatest(c.last_number, excluded.last_number);
  end loop;
end $$;

revoke all on function public.is_member(uuid), public.is_owner(uuid), public.create_company(text),
  public.allocate_number(uuid, text), public.bump_counters(uuid, jsonb) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.create_company(text),
  public.allocate_number(uuid, text), public.bump_counters(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.customers       enable row level security;
alter table public.materials       enable row level security;
alter table public.stock_movements enable row level security;
alter table public.documents       enable row level security;
alter table public.expenses        enable row level security;
alter table public.number_counters enable row level security;

create policy companies_select on public.companies for select to authenticated using (public.is_member(id));
create policy companies_update on public.companies for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy companies_delete on public.companies for delete to authenticated using (public.is_owner(id));
-- Anlegen ausschließlich über create_company()

create policy members_select on public.company_members for select to authenticated using (public.is_member(company_id));
create policy members_manage on public.company_members for all to authenticated using (public.is_owner(company_id)) with check (public.is_owner(company_id));

create policy customers_all       on public.customers       for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy materials_all       on public.materials       for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy stock_movements_all on public.stock_movements for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy documents_all       on public.documents       for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy expenses_all        on public.expenses        for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy counters_select     on public.number_counters for select to authenticated using (public.is_member(company_id));
-- Schreiben der Zähler nur über allocate_number() / bump_counters()

-- companies: kein INSERT (nur create_company), UPDATE ohne id/plan/created_at (Tarif wird serverseitig gepflegt)
grant select, delete on public.companies to authenticated;
grant update (name, owner, street, zip, city, country, email, phone, website, tax_number, vat_id, register_court,
  register_number, bank_name, iban, bic, logo, logo_ratio, small_business, default_vat, payment_term_days,
  offer_validity_days, invoice_prefix, offer_prefix, design) on public.companies to authenticated;
grant select, insert, update, delete on public.company_members, public.customers, public.materials,
  public.stock_movements, public.documents, public.expenses to authenticated;
grant select on public.number_counters to authenticated;

-- ====================================================================
-- 20261001090000_companies_and_plans.sql
-- ====================================================================
-- Mehrere Firmen je Nutzer & Tarif-Limits
--
-- * my_companies(): alle Firmen des angemeldeten Nutzers (für den Firmenwechsler)
-- * Tarif „start“: höchstens 10 Rechnungen pro Kalendermonat (nach Rechnungsdatum)
--   je Firma. Business/Team: unbegrenzt. Der Tarif steht in companies.plan und
--   ist für Nutzer nicht änderbar (siehe Spalten-Grants in der Init-Migration).

create or replace function public.my_companies()
returns table (id uuid, name text, logo text, plan text, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.logo, c.plan, m.role
  from public.companies c
  join public.company_members m on m.company_id = c.id and m.user_id = auth.uid()
  order by c.name;
$$;

create or replace function public.plan_invoice_limit(p_plan text) returns integer
language sql immutable as $$
  select case p_plan when 'start' then 10 else null end;
$$;

create or replace function public.enforce_invoice_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_used  integer;
begin
  if new.kind <> 'invoice' then
    return new;
  end if;
  -- Upsert einer bereits vorhandenen Rechnung ist kein neuer Beleg
  if tg_op = 'INSERT' and exists (select 1 from public.documents d where d.company_id = new.company_id and d.id = new.id) then
    return new;
  end if;
  -- Bei Änderungen nur prüfen, wenn eine Rechnung neu in einen Monat fällt
  if tg_op = 'UPDATE' and date_trunc('month', old.date) = date_trunc('month', new.date) and old.kind = new.kind then
    return new;
  end if;
  select public.plan_invoice_limit(c.plan) into v_limit from public.companies c where c.id = new.company_id;
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_used
  from public.documents d
  where d.company_id = new.company_id and d.kind = 'invoice'
    and date_trunc('month', d.date) = date_trunc('month', new.date)
    and d.id <> new.id;
  if v_used >= v_limit then
    raise exception 'Rechnungslimit erreicht: Im Tarif Start sind % Rechnungen pro Monat enthalten.', v_limit
      using errcode = 'P0001', hint = 'upgrade';
  end if;
  return new;
end $$;

create trigger documents_invoice_limit before insert or update of date, kind on public.documents
  for each row execute function public.enforce_invoice_limit();

revoke all on function public.my_companies() from public, anon;
grant execute on function public.my_companies() to authenticated;

-- ====================================================================
-- 20261002090000_storage_income_mail.sql
-- ====================================================================
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

-- ====================================================================
-- 20261006090000_billing.sql
-- ====================================================================
-- Tarife & Abrechnung über Stripe
-- Die Spalten werden ausschließlich serverseitig (Service-Role-Key im Webhook /
-- in den Billing-API-Routen) geschrieben. Nutzer haben darauf kein UPDATE-Recht
-- (siehe Spalten-Grants der Init-Migration), können sie aber lesen.

alter table public.companies add column if not exists stripe_customer_id     text;
alter table public.companies add column if not exists stripe_subscription_id text;
alter table public.companies add column if not exists subscription_status    text not null default 'none';
alter table public.companies add column if not exists trial_ends_at          timestamptz;
alter table public.companies add column if not exists current_period_end     timestamptz;
alter table public.companies add column if not exists cancel_at_period_end   boolean not null default false;
alter table public.companies add column if not exists trial_used             boolean not null default false;

create unique index if not exists companies_stripe_customer_idx on public.companies (stripe_customer_id) where stripe_customer_id is not null;
