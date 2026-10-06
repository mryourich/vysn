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

-- ====================================================================
-- 20261007090000_team.sql
-- ====================================================================
-- Team-Tarif: Mitarbeitende einladen, Rollen, Benutzerlimit
--
-- * Rollen je Firma: owner (Inhaber), admin, member (Mitarbeiter)
--   - owner/admin: alles inkl. Firmendaten, Design, Einstellungen, Tarif und Team
--   - member: Tagesgeschäft (Angebote, Rechnungen, Kunden, Material, Buchungen, Auswertungen),
--     keine Änderungen an Firmendaten, Design, Einstellungen, Tarif oder Team
-- * Einladungen nur im Tarif „team“, höchstens 5 Benutzer je Firma (inkl. offener Einladungen)
-- * Endet der Team-Tarif, behält nur der Inhaber Zugriff; Mitglieder bleiben gespeichert
--   und haben nach erneuter Buchung wieder Zugriff.
-- * Mitglieder werden ausschließlich über die Funktionen unten verwaltet.

create or replace function public.plan_user_limit(p_plan text) returns integer
language sql immutable as $$
  select case p_plan when 'team' then 5 else 1 end;
$$;

-- Rolle des angemeldeten Nutzers in der Firma – null, wenn kein (aktiver) Zugriff besteht.
create or replace function public.member_role(p_company uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.company_id = p_company and m.user_id = auth.uid()
    and (m.role = 'owner' or c.plan = 'team');
$$;

create or replace function public.is_member(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.member_role(p_company) is not null;
$$;

create or replace function public.is_admin(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(p_company) in ('owner', 'admin'), false);
$$;

create or replace function public.my_companies()
returns table (id uuid, name text, logo text, plan text, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.logo, c.plan, m.role
  from public.companies c
  join public.company_members m on m.company_id = c.id and m.user_id = auth.uid()
  where m.role = 'owner' or c.plan = 'team'
  order by c.name;
$$;

-- Firmendaten, Design und Einstellungen ändern nur Inhaber und Admins
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- Mitglieder nur noch über Funktionen verwalten
drop policy if exists members_manage on public.company_members;
revoke insert, update, delete on public.company_members from authenticated;

-- ---------------------------------------------------------------------------
-- Einladungen
-- ---------------------------------------------------------------------------
create table public.company_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  email       text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role        text not null default 'member' check (role in ('admin', 'member')),
  token       text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  unique (company_id, email)
);
create index company_invites_company_idx on public.company_invites (company_id);

alter table public.company_invites enable row level security;
create policy invites_select on public.company_invites for select to authenticated using (public.is_admin(company_id));
grant select on public.company_invites to authenticated;

create or replace function public.seats_used(p_company uuid) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.company_members m where m.company_id = p_company)::integer
       + (select count(*) from public.company_invites i
          where i.company_id = p_company and i.accepted_at is null and i.expires_at > now())::integer;
$$;

-- Team der Firma: Mitglieder (mit E-Mail) und offene Einladungen
create or replace function public.company_team(p_company uuid)
returns table (kind text, id text, email text, role text, created_at timestamptz, expires_at timestamptz, token text, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_admin boolean := public.is_admin(p_company);
begin
  if not public.is_member(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select 'member'::text, m.user_id::text, u.email::text, m.role, m.created_at, null::timestamptz, null::text, m.user_id = auth.uid()
    from public.company_members m left join auth.users u on u.id = m.user_id
    where m.company_id = p_company
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
  if v_admin then
    return query
      select 'invite'::text, i.id::text, i.email, i.role, i.created_at, i.expires_at, i.token, false
      from public.company_invites i
      where i.company_id = p_company and i.accepted_at is null
      order by i.created_at;
  end if;
end $$;

-- Lädt eine Person ein (bzw. erneuert eine bestehende Einladung) und liefert das Token
create or replace function public.invite_member(p_company uuid, p_email text, p_role text default 'member') returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_plan  text;
  v_token text;
begin
  if not public.is_admin(p_company) then
    raise exception 'Nur Inhaber und Admins können Mitarbeitende einladen.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Ungültige Rolle.' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = '22023';
  end if;
  select plan into v_plan from public.companies where id = p_company for update;
  if v_plan <> 'team' then
    raise exception 'Mitarbeitende einladen ist im Tarif Team enthalten.' using errcode = 'P0001', hint = 'plan_required';
  end if;
  if exists (select 1 from public.company_members m join auth.users u on u.id = m.user_id
             where m.company_id = p_company and lower(u.email) = v_email) then
    raise exception 'Diese Person gehört bereits zur Firma.' using errcode = '23505';
  end if;
  -- Eine erneuerte Einladung belegt keinen zusätzlichen Platz
  if not exists (select 1 from public.company_invites i where i.company_id = p_company and i.email = v_email
                 and i.accepted_at is null and i.expires_at > now())
     and public.seats_used(p_company) >= public.plan_user_limit(v_plan) then
    raise exception 'Alle % Plätze sind belegt. Entfernen Sie eine Person oder Einladung.', public.plan_user_limit(v_plan)
      using errcode = 'P0001', hint = 'seat_limit';
  end if;
  insert into public.company_invites as i (company_id, email, role, invited_by)
  values (p_company, v_email, p_role, auth.uid())
  on conflict (company_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by, token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
        created_at = now(), expires_at = now() + interval '14 days', accepted_at = null
  returning i.token into v_token;
  return v_token;
end $$;

create or replace function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.company_invites where id = p_invite;
  if v_company is null or not public.is_admin(v_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.company_invites where id = p_invite;
end $$;

-- Öffentliche Eckdaten einer Einladung (für die Annahme-Seite)
create or replace function public.invite_info(p_token text)
returns table (company_name text, email text, role text, expired boolean, accepted boolean)
language sql stable security definer set search_path = public as $$
  select c.name, i.email, i.role, i.expires_at <= now(), i.accepted_at is not null
  from public.company_invites i join public.companies c on c.id = i.company_id
  where i.token = p_token;
$$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv   public.company_invites;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_plan  text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_inv from public.company_invites where token = p_token for update;
  if v_inv.id is null or v_inv.accepted_at is not null then
    raise exception 'Die Einladung ist ungültig oder wurde bereits angenommen.' using errcode = 'P0001', hint = 'invalid';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'Die Einladung ist abgelaufen. Bitten Sie um eine neue Einladung.' using errcode = 'P0001', hint = 'expired';
  end if;
  if v_inv.email <> v_email then
    raise exception 'Die Einladung gilt für %. Bitte mit dieser E-Mail-Adresse anmelden.', v_inv.email using errcode = 'P0001', hint = 'wrong_email';
  end if;
  select plan into v_plan from public.companies where id = v_inv.company_id for update;
  if v_plan <> 'team' then
    raise exception 'Die Firma nutzt den Tarif Team nicht mehr. Bitte wenden Sie sich an den Inhaber.' using errcode = 'P0001', hint = 'plan_required';
  end if;
  if exists (select 1 from public.company_members where company_id = v_inv.company_id and user_id = auth.uid()) then
    update public.company_invites set accepted_at = now() where id = v_inv.id;
    return v_inv.company_id;
  end if;
  -- Die eigene offene Einladung zählt bereits als Platz
  if public.seats_used(v_inv.company_id) > public.plan_user_limit(v_plan) then
    raise exception 'Alle Plätze dieser Firma sind belegt.' using errcode = 'P0001', hint = 'seat_limit';
  end if;
  insert into public.company_members (company_id, user_id, role) values (v_inv.company_id, auth.uid(), v_inv.role);
  update public.company_invites set accepted_at = now() where id = v_inv.id;
  return v_inv.company_id;
end $$;

-- Rolle ändern (nur Inhaber; der Inhaber selbst bleibt Inhaber)
create or replace function public.set_member_role(p_company uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.member_role(p_company), '') <> 'owner' then
    raise exception 'Nur der Inhaber kann Rollen ändern.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Ungültige Rolle.' using errcode = '22023';
  end if;
  update public.company_members set role = p_role
  where company_id = p_company and user_id = p_user and role <> 'owner';
end $$;

-- Person entfernen: Inhaber alle außer sich selbst, Admins nur Mitarbeiter; jeder (außer Inhaber) sich selbst
create or replace function public.remove_member(p_company uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me     text := public.member_role(p_company);
  v_target text;
begin
  select role into v_target from public.company_members where company_id = p_company and user_id = p_user;
  if v_target is null then
    return;
  end if;
  if v_target = 'owner' then
    raise exception 'Der Inhaber kann nicht entfernt werden.' using errcode = '42501';
  end if;
  if not (
    p_user = auth.uid()
    or v_me = 'owner'
    or (v_me = 'admin' and v_target = 'member')
  ) then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  delete from public.company_members where company_id = p_company and user_id = p_user;
end $$;

revoke all on function public.plan_user_limit(text), public.member_role(uuid), public.is_admin(uuid), public.seats_used(uuid),
  public.company_team(uuid), public.invite_member(uuid, text, text), public.revoke_invite(uuid), public.invite_info(text),
  public.accept_invite(text), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.plan_user_limit(text), public.member_role(uuid), public.is_admin(uuid), public.seats_used(uuid),
  public.company_team(uuid), public.invite_member(uuid, text, text), public.revoke_invite(uuid), public.invite_info(text),
  public.accept_invite(text), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid) to authenticated;
-- Die Annahme-Seite zeigt Firma und Adresse schon vor der Anmeldung (nur mit gültigem Token)
grant execute on function public.invite_info(text) to anon;

-- ====================================================================
-- 20261008090000_solo.sql
-- ====================================================================
-- Tarif „Solo“ (9,90 €/Monat): wie Start, aber bis zu 50 Rechnungen pro Monat.
-- Reihenfolge der Tarife: start → solo → business → team

alter table public.companies drop constraint if exists companies_plan_check;
alter table public.companies add constraint companies_plan_check check (plan in ('start', 'solo', 'business', 'team'));

create or replace function public.plan_invoice_limit(p_plan text) returns integer
language sql immutable as $$
  select case p_plan when 'start' then 10 when 'solo' then 50 else null end;
$$;

create or replace function public.enforce_invoice_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_plan  text;
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
  select c.plan into v_plan from public.companies c where c.id = new.company_id;
  v_limit := public.plan_invoice_limit(v_plan);
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_used
  from public.documents d
  where d.company_id = new.company_id and d.kind = 'invoice'
    and date_trunc('month', d.date) = date_trunc('month', new.date)
    and d.id <> new.id;
  if v_used >= v_limit then
    raise exception 'Rechnungslimit erreicht: Im Tarif % sind % Rechnungen pro Monat enthalten.', initcap(v_plan), v_limit
      using errcode = 'P0001', hint = 'upgrade';
  end if;
  return new;
end $$;

-- ====================================================================
-- 20261009090000_harden_grants.sql
-- ====================================================================
-- Rechte härten
--
-- Supabase vergibt per Standard („default privileges“) ALLE Tabellenrechte an anon und
-- authenticated. Ein tabellenweites UPDATE-Recht hebelt die Spalten-Grants aus – Nutzer
-- könnten sonst z. B. companies.plan oder die Stripe-Felder selbst ändern.
-- Hier werden die Rechte auf das Nötige zurückgesetzt; Zeilen schützt weiterhin RLS.

-- anon (nicht angemeldet) braucht keinen direkten Tabellenzugriff
revoke all on all tables in schema public from anon;

-- Firmen: anlegen nur über create_company(), ändern nur erlaubte Spalten
-- (REVOKE auf Tabellenebene entfernt auch Spaltenrechte – daher danach neu vergeben)
revoke all on public.companies from authenticated;
grant select, delete on public.companies to authenticated;
grant update (name, owner, street, zip, city, country, email, phone, website, tax_number, vat_id, register_court,
  register_number, bank_name, iban, bic, logo, logo_ratio, small_business, default_vat, payment_term_days,
  offer_validity_days, invoice_prefix, offer_prefix, design, settings) on public.companies to authenticated;

-- Mitglieder, Einladungen und Zähler nur über Funktionen ändern
revoke all on public.company_members, public.company_invites, public.number_counters from authenticated;
grant select on public.company_members, public.company_invites, public.number_counters to authenticated;

-- Geschäftsdaten: lesen/schreiben (RLS begrenzt auf eigene Firmen), keine Sonderrechte
revoke truncate, references, trigger on public.customers, public.materials, public.stock_movements,
  public.documents, public.expenses, public.storage_locations from authenticated;

-- ====================================================================
-- 20261010090000_usage_limits.sql
-- ====================================================================
-- Monatslimits je Tarif und serverseitiger Lagerbestand
--
-- * Gezählt wird jedes NEU ANGELEGTE Element im Kalendermonat (Zeitzone Europe/Berlin):
--   Rechnungen, Angebote, Kunden, Artikel und Buchungen (Einnahmen/Ausgaben).
--   Löschen gibt nichts zurück – ein angelegtes Element bleibt gezählt.
-- * Limits: start 10, solo 50 je Art und Monat; business/team unbegrenzt.
-- * Lagerbestand: materials.stock wird ausschließlich über stock_movements fortgeschrieben
--   (Zu-/Abgang als Differenz). So gehen gleichzeitige oder offline erfasste Buchungen
--   mehrerer Geräte nicht verloren.

create table public.usage_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  month      date not null,
  kind       text not null check (kind in ('invoice', 'offer', 'customer', 'material', 'booking')),
  used       integer not null default 0,
  primary key (company_id, month, kind)
);

alter table public.usage_counters enable row level security;
create policy usage_select on public.usage_counters for select to authenticated using (public.is_member(company_id));
revoke all on public.usage_counters from anon, authenticated;
grant select on public.usage_counters to authenticated;

create or replace function public.plan_monthly_limit(p_plan text) returns integer
language sql immutable as $$
  select case p_plan when 'start' then 10 when 'solo' then 50 else null end;
$$;

-- Bisherige Funktion bleibt erhalten (gleiche Werte)
create or replace function public.plan_invoice_limit(p_plan text) returns integer
language sql immutable as $$
  select public.plan_monthly_limit(p_plan);
$$;

create or replace function public.usage_month() returns date
language sql stable as $$
  select date_trunc('month', now() at time zone 'Europe/Berlin')::date;
$$;

-- Zählt ein neues Element und bricht ab, wenn das Monatslimit überschritten würde
create or replace function public.count_usage(p_company uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_plan  text;
  v_limit integer;
  v_used  integer;
  v_label text := case p_kind when 'invoice' then 'Rechnungen' when 'offer' then 'Angebote' when 'customer' then 'Kunden'
                              when 'material' then 'Artikel' else 'Buchungen' end;
begin
  select plan into v_plan from public.companies where id = p_company;
  v_limit := public.plan_monthly_limit(v_plan);
  insert into public.usage_counters as u (company_id, month, kind, used)
  values (p_company, public.usage_month(), p_kind, 1)
  on conflict (company_id, month, kind) do update set used = u.used + 1
  returning used into v_used;
  if v_limit is not null and v_used > v_limit then
    raise exception 'Limit erreicht: Im Tarif % sind % % pro Monat enthalten.', initcap(v_plan), v_limit, v_label
      using errcode = 'P0001', hint = 'upgrade:' || p_kind;
  end if;
end $$;

create or replace function public.track_usage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind   text;
  v_exists boolean;
begin
  v_kind := case tg_table_name
    when 'documents' then to_jsonb(new) ->> 'kind'
    when 'customers' then 'customer'
    when 'materials' then 'material'
    when 'expenses'  then 'booking'
  end;
  if tg_op = 'UPDATE' then
    -- Nur ein Wechsel der Belegart (z. B. Angebot → Rechnung) zählt als neues Element
    if tg_table_name = 'documents' and old.kind is distinct from new.kind then
      perform public.count_usage(new.company_id, v_kind);
    end if;
    return new;
  end if;
  -- Upsert eines bereits vorhandenen Datensatzes ist kein neues Element
  execute format('select exists (select 1 from public.%I where company_id = $1 and id = $2)', tg_table_name)
    into v_exists using new.company_id, new.id;
  if not v_exists then
    perform public.count_usage(new.company_id, v_kind);
  end if;
  return new;
end $$;

drop trigger if exists documents_invoice_limit on public.documents;
create trigger documents_usage before insert or update of kind on public.documents
  for each row execute function public.track_usage();
create trigger customers_usage before insert on public.customers
  for each row execute function public.track_usage();
create trigger materials_usage before insert on public.materials
  for each row execute function public.track_usage();
create trigger expenses_usage before insert on public.expenses
  for each row execute function public.track_usage();

-- Startwerte für den laufenden Monat aus bereits vorhandenen Daten (soweit datiert)
insert into public.usage_counters (company_id, month, kind, used)
select company_id, public.usage_month(), kind, count(*)
from public.documents
where (created_at at time zone 'Europe/Berlin') >= public.usage_month()
group by company_id, kind
on conflict (company_id, month, kind) do update set used = greatest(public.usage_counters.used, excluded.used);

insert into public.usage_counters (company_id, month, kind, used)
select company_id, public.usage_month(), 'customer', count(*)
from public.customers
where created_at >= public.usage_month()
group by company_id
on conflict (company_id, month, kind) do update set used = greatest(public.usage_counters.used, excluded.used);

-- ---------------------------------------------------------------------------
-- Lagerbestand serverseitig aus Bewegungen fortschreiben
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Upsert einer bereits gebuchten Bewegung (erneutes Senden) nicht doppelt buchen
    update public.materials set stock = stock + new.quantity
    where company_id = new.company_id and id = new.material_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.materials set stock = stock - old.quantity
    where company_id = old.company_id and id = old.material_id;
    return old;
  end if;
  return null;
end $$;

-- Erneut gesendete Bewegungen (gleiche id) dürfen nicht doppelt zählen: Upsert auf eine
-- vorhandene Bewegung wird übersprungen, statt sie zu aktualisieren.
create or replace function public.skip_existing_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.stock_movements where company_id = new.company_id and id = new.id) then
    return null;
  end if;
  return new;
end $$;

create trigger stock_movements_skip_existing before insert on public.stock_movements
  for each row execute function public.skip_existing_movement();
create trigger stock_movements_apply after insert or delete on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Bestand darf vom Client nicht mehr direkt gesetzt werden (nur über Bewegungen)
revoke update (stock) on public.materials from authenticated;
revoke all on public.materials from authenticated;
grant select, insert, delete on public.materials to authenticated;
grant update (company_id, id, number, name, description, category, unit, purchase_price, sale_price, vat, min_stock, location_id)
  on public.materials to authenticated;

revoke all on function public.count_usage(uuid, text), public.track_usage(), public.apply_stock_movement(),
  public.skip_existing_movement() from public, anon, authenticated;

-- ====================================================================
-- 20261011090000_realtime.sql
-- ====================================================================
-- Realtime: Änderungen anderer Geräte/Teammitglieder live übertragen
--
-- Supabase Realtime prüft Row Level Security – jedes Gerät erhält nur Zeilen seiner
-- Firmen. Gelöschte Zeilen liefern nur den Primärschlüssel (company_id, id); die App
-- filtert sie selbst nach der aktiven Firma.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publikation supabase_realtime fehlt (kein Supabase) – übersprungen';
    return;
  end if;
  foreach t in array array['companies', 'customers', 'materials', 'stock_movements', 'documents', 'expenses',
                           'storage_locations', 'usage_counters'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ====================================================================
-- 20261012090000_company_limit.sql
-- ====================================================================
-- Anzahl Firmen je Tarif
--
-- Start und Solo enthalten eine Firma. Weitere Firmen kann nur anlegen, wer mindestens eine
-- eigene Firma (Rolle owner) im Tarif Business oder Team hat. Firmen, in denen man nur
-- Mitglied ist, zählen nicht. Bereits bestehende Firmen bleiben unverändert erhalten.

create or replace function public.can_add_company() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.company_members m where m.user_id = auth.uid() and m.role = 'owner')
      or exists (select 1 from public.company_members m join public.companies c on c.id = m.company_id
                 where m.user_id = auth.uid() and m.role = 'owner' and c.plan in ('business', 'team'));
$$;

create or replace function public.create_company(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.can_add_company() then
    raise exception 'Weitere Firmen sind in den Tarifen Business und Team enthalten.'
      using errcode = 'P0001', hint = 'upgrade:company';
  end if;
  insert into public.companies (name) values (coalesce(nullif(trim(p_name), ''), 'Meine Firma')) returning id into v_id;
  insert into public.company_members (company_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

revoke all on function public.can_add_company() from public, anon;
grant execute on function public.can_add_company() to authenticated;
