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
