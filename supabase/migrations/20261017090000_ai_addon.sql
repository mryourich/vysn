-- KI-Sprachassistent als Zusatzbuchung (eigenes Stripe-Abo) mit Kostenschutz
--
-- ai_*        Zustand des KI-Abos je Firma; nur serverseitig beschreibbar (kein UPDATE-Grant für Nutzer)
-- ai_usage    Anfragen je Firma und Tag (Tag nach deutscher Zeit)
-- ai_take()   zählt eine Anfrage, sofern Tages- und Monatslimit nicht erreicht sind; nur für den Server

alter table public.companies add column if not exists ai_customer_id        text;
alter table public.companies add column if not exists ai_subscription_id    text;
alter table public.companies add column if not exists ai_status             text;
alter table public.companies add column if not exists ai_period_end         timestamptz;
alter table public.companies add column if not exists ai_cancel_at_period_end boolean not null default false;

create table if not exists public.ai_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  day        date not null,
  requests   integer not null default 0,
  primary key (company_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Rückgabe: verbleibende Anfragen heute nach dieser (>= 0), -1 = Tageslimit erreicht, -2 = Monatslimit erreicht
drop function if exists public.ai_take(uuid, integer);
create or replace function public.ai_take(p_company uuid, p_daily integer, p_monthly integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_day   date := (now() at time zone 'Europe/Berlin')::date;
  v_month integer;
  v_used  integer;
begin
  -- gleichzeitige Anfragen derselben Firma nacheinander zählen
  perform pg_advisory_xact_lock(hashtext('ai_take:' || p_company::text));
  select coalesce(sum(requests), 0) into v_month from public.ai_usage
   where company_id = p_company and day >= date_trunc('month', v_day)::date;
  if v_month >= p_monthly then return -2; end if;
  insert into public.ai_usage (company_id, day, requests) values (p_company, v_day, 1)
  on conflict (company_id, day) do update set requests = public.ai_usage.requests + 1
    where public.ai_usage.requests < p_daily
  returning requests into v_used;
  if v_used is null then return -1; end if;
  return least(p_daily - v_used, p_monthly - v_month - 1);
end $$;

revoke all on function public.ai_take(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer, integer) to service_role;
