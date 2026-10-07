-- Tarifwechsel: teurer sofort, günstiger zum Ende der Laufzeit
--
-- billing_interval  monthly | yearly (aktueller Zahlungsrhythmus)
-- pending_*         vorgemerkter Wechsel zum Laufzeitende (Stripe Subscription Schedule)
--                   bzw. pending_plan = 'start' bei Kündigung zum Laufzeitende
-- Wie alle Abrechnungsfelder nur serverseitig beschreibbar (kein UPDATE-Grant für Nutzer).

alter table public.companies add column if not exists billing_interval  text;
alter table public.companies add column if not exists pending_plan      text;
alter table public.companies add column if not exists pending_interval  text;
alter table public.companies add column if not exists pending_change_at timestamptz;
