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
