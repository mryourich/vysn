-- Baustellen: Regiestunden, Material, Fotos und Mängel je Baustelle – daraus direkt die Rechnung
--
-- projects          Baustelle (Kunde, Adresse, Stundensatz, Status)
-- project_entries   Einträge: hours (Regiestunden), material, photo, defect (Mangel), note
--                   invoice_id = Rechnung, mit der Stunden/Material abgerechnet wurden
-- Fotos liegen im privaten Bucket „project-files“ unter <company_id>/<project_id>/<datei>.
-- Zugriff nur für Mitglieder der Firma.

create table if not exists public.projects (
  company_id   uuid not null references public.companies (id) on delete cascade,
  id           text not null,
  number       text not null default '',
  name         text not null,
  customer_id  text,
  street       text not null default '',
  zip          text not null default '',
  city         text not null default '',
  status       text not null default 'active' check (status in ('active', 'done')),
  start_date   date,
  hourly_rate  numeric(12, 2) not null default 0,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, customer_id) references public.customers (company_id, id) on delete set null (customer_id)
);
create index if not exists projects_customer_idx on public.projects (company_id, customer_id);

create table if not exists public.project_entries (
  company_id   uuid not null references public.companies (id) on delete cascade,
  id           text not null,
  project_id   text not null,
  kind         text not null check (kind in ('hours', 'material', 'photo', 'defect', 'note')),
  date         date not null default current_date,
  person       text not null default '',
  description  text not null default '',
  quantity     numeric(12, 3) not null default 0,
  unit         text not null default '',
  unit_price   numeric(12, 2) not null default 0,
  vat          numeric(5, 2),
  material_id  text,
  photo_path   text,
  status       text not null default 'open' check (status in ('open', 'done')),
  invoice_id   text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade
);
create index if not exists project_entries_project_idx on public.project_entries (company_id, project_id, date);

alter table public.projects enable row level security;
alter table public.project_entries enable row level security;
drop policy if exists projects_all on public.projects;
drop policy if exists project_entries_all on public.project_entries;
create policy projects_all on public.projects for all to authenticated
  using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy project_entries_all on public.project_entries for all to authenticated
  using (public.is_member(company_id)) with check (public.is_member(company_id));
revoke all on public.projects, public.project_entries from anon, authenticated;
grant select, insert, update, delete on public.projects, public.project_entries to authenticated;

-- Fotos
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists project_files_read on storage.objects;
drop policy if exists project_files_write on storage.objects;
drop policy if exists project_files_delete on storage.objects;
create policy project_files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy project_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy project_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.is_member(((storage.foldername(name))[1])::uuid));
