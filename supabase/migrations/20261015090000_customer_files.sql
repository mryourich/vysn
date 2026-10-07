-- Dokumente je Kunde (PDF, Word, Excel, Bilder …)
--
-- Dateien liegen im privaten Storage-Bucket „customer-files“ unter <company_id>/<customer_id>/<datei>.
-- Zugriff nur für Mitglieder der Firma (erster Ordner = company_id). Die Tabelle customer_files
-- hält Name, Größe und Typ für die Anzeige.

insert into storage.buckets (id, name, public, file_size_limit)
values ('customer-files', 'customer-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists customer_files_read on storage.objects;
drop policy if exists customer_files_write on storage.objects;
drop policy if exists customer_files_delete on storage.objects;
create policy customer_files_read on storage.objects for select to authenticated
  using (bucket_id = 'customer-files' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy customer_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-files' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy customer_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'customer-files' and public.is_member(((storage.foldername(name))[1])::uuid));

create table if not exists public.customer_files (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  customer_id text not null,
  name        text not null,
  size        bigint not null default 0,
  mime        text not null default '',
  path        text not null,
  created_at  timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, customer_id) references public.customers (company_id, id) on delete cascade
);
create index if not exists customer_files_customer_idx on public.customer_files (company_id, customer_id);

alter table public.customer_files enable row level security;
drop policy if exists customer_files_all on public.customer_files;
create policy customer_files_all on public.customer_files for all to authenticated
  using (public.is_member(company_id)) with check (public.is_member(company_id));
revoke all on public.customer_files from anon, authenticated;
grant select, insert, delete on public.customer_files to authenticated;
