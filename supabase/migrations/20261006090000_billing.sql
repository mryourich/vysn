-- Tarife & Abrechnung über Stripe
-- Die Spalten werden ausschließlich serverseitig (Service-Role-Key im Webhook /
-- in den Billing-API-Routen) geschrieben. Nutzer haben darauf kein UPDATE-Recht
-- (siehe Spalten-Grants der Init-Migration), können sie aber lesen.

alter table public.companies add column if not exists stripe_customer_id     text;
alter table public.companies add column if not exists stripe_subscription_id text;
alter table public.companies add column if not exists subscription_status    text not null default 'none';
alter table public.companies add column if not exists trial_ends_at          timestamptz;
alter table public.companies add column if not exists current_period_end     timestamptz;
alter table public.companies add column if not exists cancel_at_period_end   boolean not null default false;
alter table public.companies add column if not exists trial_used             boolean not null default false;

create unique index if not exists companies_stripe_customer_idx on public.companies (stripe_customer_id) where stripe_customer_id is not null;
