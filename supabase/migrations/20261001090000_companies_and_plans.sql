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
