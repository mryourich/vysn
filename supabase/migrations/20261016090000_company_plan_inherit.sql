-- Weitere Firmen übernehmen den Tarif (Business/Team) der zahlenden Firma
--
-- billing_parent zeigt auf die Firma mit dem Abo. Neue Firmen eines Inhabers mit Business-
-- oder Team-Abo bekommen dessen Tarif; ändert sich der Tarif der zahlenden Firma (Upgrade,
-- Wechsel, Kündigung, Widerruf), folgen alle verknüpften Firmen automatisch.

alter table public.companies add column if not exists billing_parent uuid references public.companies (id) on delete set null;
create index if not exists companies_billing_parent_idx on public.companies (billing_parent) where billing_parent is not null;

-- Zahlende Firma (mit Business/Team) des aktuellen Nutzers als Inhaber
create or replace function public.paying_company() returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.company_members m join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid() and m.role = 'owner' and c.billing_parent is null and c.plan in ('business', 'team')
  order by (c.plan = 'team') desc, (c.stripe_subscription_id is not null) desc, c.created_at
  limit 1;
$$;

create or replace function public.create_company(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_parent uuid;
  v_plan   text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.can_add_company() then
    raise exception 'Weitere Firmen sind in den Tarifen Business und Team enthalten.'
      using errcode = 'P0001', hint = 'upgrade:company';
  end if;
  v_parent := public.paying_company();
  select plan into v_plan from public.companies where id = v_parent;
  insert into public.companies (name, plan, billing_parent)
  values (coalesce(nullif(trim(p_name), ''), 'Meine Firma'), coalesce(v_plan, 'start'), v_parent)
  returning id into v_id;
  insert into public.company_members (company_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- Tarifänderung der zahlenden Firma an verknüpfte Firmen weitergeben
create or replace function public.propagate_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan is distinct from old.plan and new.billing_parent is null then
    update public.companies set plan = new.plan where billing_parent = new.id and plan is distinct from new.plan;
  end if;
  return new;
end $$;

drop trigger if exists companies_propagate_plan on public.companies;
create trigger companies_propagate_plan after update of plan on public.companies
  for each row execute function public.propagate_plan();

-- Bestehende Zusatzfirmen (bisher Start) eines Inhabers mit Business/Team nachträglich verknüpfen
with payer as (
  select distinct on (m.user_id) m.user_id, c.id, c.plan
  from public.company_members m join public.companies c on c.id = m.company_id
  where m.role = 'owner' and c.plan in ('business', 'team')
  order by m.user_id, (c.plan = 'team') desc, (c.stripe_subscription_id is not null) desc, c.created_at
)
update public.companies c set plan = p.plan, billing_parent = p.id
from public.company_members m join payer p on p.user_id = m.user_id
where m.company_id = c.id and m.role = 'owner' and c.id <> p.id
  and c.plan = 'start' and c.stripe_subscription_id is null and c.billing_parent is null;

revoke all on function public.paying_company() from public, anon;
grant execute on function public.paying_company() to authenticated;
revoke all on function public.propagate_plan() from public, anon, authenticated;
