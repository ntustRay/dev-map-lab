-- Dev Map Lab on Neon. Requires Managed Better Auth and Data API with default grants disabled.
create table public.devmap_profiles (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  updated_at timestamptz not null default now()
);

create table public.devmap_workspaces (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  revision integer not null check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint devmap_payload_shape check (coalesce((
    jsonb_typeof(payload) = 'object'
    and payload -> 'schemaVersion' = '1'::jsonb
    and jsonb_typeof(payload -> 'exportedAt') = 'number'
    and jsonb_typeof(payload -> 'notes') = 'array'
    and jsonb_typeof(payload -> 'attempts') = 'array'
    and jsonb_typeof(payload -> 'progress') = 'array'
    and jsonb_typeof(payload -> 'drafts') = 'array'
    and payload ?& array['schemaVersion', 'exportedAt', 'notes', 'attempts', 'progress', 'drafts']
  ), false)),
  constraint devmap_payload_size check (octet_length(payload::text) <= 5242880)
);

alter table public.devmap_profiles enable row level security;
alter table public.devmap_workspaces enable row level security;

revoke all on public.devmap_profiles, public.devmap_workspaces from public, anonymous;
grant select, insert, update on public.devmap_profiles, public.devmap_workspaces to authenticated;

create policy "devmap_profile_select_own" on public.devmap_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "devmap_profile_insert_own" on public.devmap_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "devmap_profile_update_own" on public.devmap_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "devmap_workspace_select_own" on public.devmap_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "devmap_workspace_insert_own" on public.devmap_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "devmap_workspace_update_own" on public.devmap_workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.devmap_save_workspace(
  expected_user_id uuid,
  expected_revision integer,
  new_payload jsonb
) returns table (new_revision integer, saved_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null or owner_id is distinct from expected_user_id then
    raise exception using errcode = '42501', message = 'account_changed';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception using errcode = '22023', message = 'invalid_revision';
  end if;

  if expected_revision = 0 then
    insert into public.devmap_workspaces as workspace (user_id, revision, payload)
      values (owner_id, 1, new_payload)
      on conflict (user_id) do nothing
      returning workspace.revision, workspace.updated_at into new_revision, saved_at;
    if found then return next; return; end if;
  else
    update public.devmap_workspaces as workspace
      set payload = new_payload, revision = workspace.revision + 1, updated_at = pg_catalog.statement_timestamp()
      where workspace.user_id = owner_id and workspace.revision = expected_revision
      returning workspace.revision, workspace.updated_at into new_revision, saved_at;
    if found then return next; return; end if;
  end if;

  raise exception using errcode = '40001', message = 'workspace_conflict';
end;
$$;

revoke execute on function public.devmap_save_workspace(uuid, integer, jsonb) from public, anonymous;
grant execute on function public.devmap_save_workspace(uuid, integer, jsonb) to authenticated;

create schema if not exists devmap_internal;
revoke all on schema devmap_internal from public, anonymous, authenticated;
create table devmap_internal.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
revoke all on devmap_internal.schema_migrations from public, anonymous, authenticated;
insert into devmap_internal.schema_migrations(version) values ('202611050001_member_workspace');
