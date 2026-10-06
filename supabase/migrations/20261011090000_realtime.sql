-- Realtime: Änderungen anderer Geräte/Teammitglieder live übertragen
--
-- Supabase Realtime prüft Row Level Security – jedes Gerät erhält nur Zeilen seiner
-- Firmen. Gelöschte Zeilen liefern nur den Primärschlüssel (company_id, id); die App
-- filtert sie selbst nach der aktiven Firma.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publikation supabase_realtime fehlt (kein Supabase) – übersprungen';
    return;
  end if;
  foreach t in array array['companies', 'customers', 'materials', 'stock_movements', 'documents', 'expenses',
                           'storage_locations', 'usage_counters'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
