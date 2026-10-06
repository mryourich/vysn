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
