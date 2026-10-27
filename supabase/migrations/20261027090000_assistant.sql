-- Assistent (KI-Zusatzbuchung): Kostendeckel je Firma und eigenes E-Mail-Postfach
--
-- ai_usage.cost_micros   tatsächliche API-Kosten je Firma und Tag (Millionstel US-Dollar)
-- ai_take()              zählt eine Aufgabe, sofern Tages-, Monats- und Kostenlimit nicht erreicht sind
-- ai_add_cost()          bucht die Kosten einer Aufgabe nach
-- mail_accounts          IMAP/SMTP-Zugang der Firma; Passwort verschlüsselt (Schlüssel nur auf dem Server),
--                        für Nutzer weder lesbar noch schreibbar – Zugriff nur über den Server

alter table public.ai_usage add column if not exists cost_micros bigint not null default 0;

drop function if exists public.ai_take(uuid, integer, integer);
-- Rückgabe: verbleibende Aufgaben im Monat nach dieser (>= 0), -1 = Tageslimit, -2 = Monatslimit, -3 = Kostendeckel
create or replace function public.ai_take(p_company uuid, p_daily integer, p_monthly integer, p_cost_cap bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_day   date := (now() at time zone 'Europe/Berlin')::date;
  v_month integer;
  v_cost  bigint;
  v_used  integer;
begin
  perform pg_advisory_xact_lock(hashtext('ai_take:' || p_company::text));
  select coalesce(sum(requests), 0), coalesce(sum(cost_micros), 0) into v_month, v_cost from public.ai_usage
   where company_id = p_company and day >= date_trunc('month', v_day)::date;
  if v_month >= p_monthly then return -2; end if;
  if v_cost >= p_cost_cap then return -3; end if;
  insert into public.ai_usage (company_id, day, requests) values (p_company, v_day, 1)
  on conflict (company_id, day) do update set requests = public.ai_usage.requests + 1
    where public.ai_usage.requests < p_daily
  returning requests into v_used;
  if v_used is null then return -1; end if;
  return p_monthly - v_month - 1;
end $$;

create or replace function public.ai_add_cost(p_company uuid, p_micros bigint) returns void
language sql security definer set search_path = public as $$
  insert into public.ai_usage (company_id, day, requests, cost_micros)
  values (p_company, (now() at time zone 'Europe/Berlin')::date, 0, greatest(p_micros, 0))
  on conflict (company_id, day) do update set cost_micros = public.ai_usage.cost_micros + greatest(p_micros, 0);
$$;

-- Verbrauch im laufenden Monat (für die Anzeige „noch x Aufgaben“)
create or replace function public.ai_month_usage(p_company uuid) returns integer
language sql security definer set search_path = public as $$
  select coalesce(sum(requests), 0)::integer from public.ai_usage
   where company_id = p_company and day >= date_trunc('month', (now() at time zone 'Europe/Berlin')::date)::date;
$$;

revoke all on function public.ai_take(uuid, integer, integer, bigint), public.ai_add_cost(uuid, bigint), public.ai_month_usage(uuid) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer, integer, bigint), public.ai_add_cost(uuid, bigint), public.ai_month_usage(uuid) to service_role;

create table if not exists public.mail_accounts (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  username     text not null,
  secret       text not null,
  imap_host    text not null,
  imap_port    integer not null default 993,
  imap_secure  boolean not null default true,
  smtp_host    text not null,
  smtp_port    integer not null default 465,
  smtp_secure  boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.mail_accounts enable row level security;
revoke all on public.mail_accounts from anon, authenticated;
