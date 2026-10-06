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
