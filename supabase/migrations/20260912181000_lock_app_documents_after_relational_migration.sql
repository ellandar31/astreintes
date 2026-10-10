-- Locks the former Firebase-like document table after the relational cutover.
--
-- The table is deliberately kept readable for audit and rollback checks, but
-- writes must stop here. Otherwise an old deployed bundle or a stale browser
-- cache can keep updating app_documents while the current application writes to
-- the relational tables, creating two divergent sources of truth.

revoke insert, update, delete on public.app_documents from authenticated;

drop policy if exists "Authenticated users can insert app documents" on public.app_documents;
drop policy if exists "Authenticated users can update app documents" on public.app_documents;
drop policy if exists "Authenticated users can delete app documents" on public.app_documents;

drop trigger if exists prevent_app_documents_writes_after_relational_cutover on public.app_documents;

create or replace function public.prevent_app_documents_writes_after_relational_cutover()
returns trigger
language plpgsql
as $$
begin
  raise exception 'app_documents is read-only after relational migration';
end;
$$;

create trigger prevent_app_documents_writes_after_relational_cutover
before insert or update or delete on public.app_documents
for each row
execute function public.prevent_app_documents_writes_after_relational_cutover();
