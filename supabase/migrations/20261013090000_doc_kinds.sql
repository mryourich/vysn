-- Weitere Belegarten: Auftragsbestätigung, Lieferschein, Bestellung
--
-- * documents.kind erlaubt zusätzlich confirmation, delivery und order.
-- * Monatslimits (Start 10, Solo 50) gelten je Belegart auch für die neuen Arten.
-- * Nummernkreise laufen wie bisher über allocate_number('<art>:<jahr>').

alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check
  check (kind in ('offer', 'confirmation', 'delivery', 'invoice', 'order'));

alter table public.usage_counters drop constraint if exists usage_counters_kind_check;
alter table public.usage_counters add constraint usage_counters_kind_check
  check (kind in ('invoice', 'offer', 'confirmation', 'delivery', 'order', 'customer', 'material', 'booking'));

create or replace function public.count_usage(p_company uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_plan  text;
  v_limit integer;
  v_used  integer;
  v_label text := case p_kind when 'invoice' then 'Rechnungen' when 'offer' then 'Angebote'
                              when 'confirmation' then 'Auftragsbestätigungen' when 'delivery' then 'Lieferscheine'
                              when 'order' then 'Bestellungen' when 'customer' then 'Kunden'
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

revoke all on function public.count_usage(uuid, text) from public, anon, authenticated;
