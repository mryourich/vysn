-- Rechte härten
--
-- Supabase vergibt per Standard („default privileges“) ALLE Tabellenrechte an anon und
-- authenticated. Ein tabellenweites UPDATE-Recht hebelt die Spalten-Grants aus – Nutzer
-- könnten sonst z. B. companies.plan oder die Stripe-Felder selbst ändern.
-- Hier werden die Rechte auf das Nötige zurückgesetzt; Zeilen schützt weiterhin RLS.

-- anon (nicht angemeldet) braucht keinen direkten Tabellenzugriff
revoke all on all tables in schema public from anon;

-- Firmen: anlegen nur über create_company(), ändern nur erlaubte Spalten
-- (REVOKE auf Tabellenebene entfernt auch Spaltenrechte – daher danach neu vergeben)
revoke all on public.companies from authenticated;
grant select, delete on public.companies to authenticated;
grant update (name, owner, street, zip, city, country, email, phone, website, tax_number, vat_id, register_court,
  register_number, bank_name, iban, bic, logo, logo_ratio, small_business, default_vat, payment_term_days,
  offer_validity_days, invoice_prefix, offer_prefix, design, settings) on public.companies to authenticated;

-- Mitglieder, Einladungen und Zähler nur über Funktionen ändern
revoke all on public.company_members, public.company_invites, public.number_counters from authenticated;
grant select on public.company_members, public.company_invites, public.number_counters to authenticated;

-- Geschäftsdaten: lesen/schreiben (RLS begrenzt auf eigene Firmen), keine Sonderrechte
revoke truncate, references, trigger on public.customers, public.materials, public.stock_movements,
  public.documents, public.expenses, public.storage_locations from authenticated;
