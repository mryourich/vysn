-- KI-Sprachassistent: Tageslimit je Firma (Kostenschutz)
--
-- Jede Anfrage an den Assistenten zählt einen Tageszähler hoch (Tag nach deutscher Zeit).
-- Nur der Server (service_role) ruft ai_take() auf; Nutzer haben keinen Zugriff.

create table if not exists public.ai_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  day        date not null,
  requests   integer not null default 0,
  primary key (company_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Zählt eine Anfrage, sofern das Limit noch nicht erreicht ist.
-- Rückgabe: verbleibende Anfragen nach dieser (>= 0) oder -1, wenn das Limit erreicht ist.
create or replace function public.ai_take(p_company uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_day  date := (now() at time zone 'Europe/Berlin')::date;
  v_used integer;
begin
  insert into public.ai_usage (company_id, day, requests) values (p_company, v_day, 1)
  on conflict (company_id, day) do update set requests = public.ai_usage.requests + 1
    where public.ai_usage.requests < p_limit
  returning requests into v_used;
  if v_used is null then return -1; end if;
  return p_limit - v_used;
end $$;

revoke all on function public.ai_take(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer) to service_role;
