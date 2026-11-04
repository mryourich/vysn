-- Assistent: gespeicherte Gespräche je Nutzer und Firma
--
-- messages  Verlauf im Format der Claude-API (wird bei der nächsten Frage wieder mitgeschickt)
-- bubbles   Anzeige in der App (Texte, Vorschläge, erledigte Aktionen)

create table if not exists public.assistant_chats (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '',
  messages    jsonb not null default '[]'::jsonb,
  bubbles     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists assistant_chats_user_idx on public.assistant_chats (company_id, user_id, updated_at desc);

alter table public.assistant_chats enable row level security;
drop policy if exists assistant_chats_own on public.assistant_chats;
-- Jeder sieht nur seine eigenen Gespräche – und nur in Firmen, in denen er Mitglied ist
create policy assistant_chats_own on public.assistant_chats for all to authenticated
  using (user_id = auth.uid() and public.is_member(company_id))
  with check (user_id = auth.uid() and public.is_member(company_id));

revoke all on public.assistant_chats from anon, authenticated;
grant select, insert, update, delete on public.assistant_chats to authenticated;
