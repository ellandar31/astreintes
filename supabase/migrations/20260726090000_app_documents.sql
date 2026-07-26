-- Supabase persistence model for the Astreintes application.
--
-- The Angular code stores feature aggregates as JSON documents through a
-- central store. This keeps the current NgRx effects independent from the
-- database implementation while leaving room for a later migration to typed
-- relational tables when the domain stabilizes further.

create table if not exists public.app_documents (
  collection_name text not null,
  document_id text not null,
  parent_collection_name text,
  parent_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_name, document_id)
);

create index if not exists app_documents_collection_idx
  on public.app_documents (collection_name);

create index if not exists app_documents_parent_idx
  on public.app_documents (parent_collection_name, parent_id);

create or replace function public.set_app_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_documents_updated_at on public.app_documents;

create trigger set_app_documents_updated_at
before update on public.app_documents
for each row
execute function public.set_app_documents_updated_at();

alter table public.app_documents enable row level security;

-- RLS policies decide which rows can be accessed, but PostgREST also needs
-- explicit SQL privileges on the table for the API roles. Without these grants,
-- authenticated users receive PostgreSQL 42501 before RLS is even evaluated.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_documents to authenticated;
grant select on public.app_documents to anon;

drop policy if exists "Authenticated users can read app documents" on public.app_documents;
drop policy if exists "Authenticated users can insert app documents" on public.app_documents;
drop policy if exists "Authenticated users can update app documents" on public.app_documents;
drop policy if exists "Authenticated users can delete app documents" on public.app_documents;

-- Matches the former document-store rules during the provider migration: every
-- authenticated user can read/write application data. Business-level role
-- restrictions remain enforced in the UI today and can later be moved here.
create policy "Authenticated users can read app documents"
on public.app_documents
for select
to authenticated
using (true);

create policy "Authenticated users can insert app documents"
on public.app_documents
for insert
to authenticated
with check (true);

create policy "Authenticated users can update app documents"
on public.app_documents
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete app documents"
on public.app_documents
for delete
to authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_documents'
  ) then
    alter publication supabase_realtime add table public.app_documents;
  end if;
end;
$$;
