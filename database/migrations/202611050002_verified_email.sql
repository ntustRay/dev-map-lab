-- Enforce verification in PostgreSQL even before the Auth console setting is enabled.
-- emailVerified comes from the Neon Auth signed JWT, never from editable user metadata.
-- Neon manages the auth schema ACL. Bind auth.uid() at CREATE time so an
-- invoker PL/pgSQL RPC does not need runtime schema USAGE. No elevated role.
create or replace function public.devmap_current_user_id() returns uuid
language sql stable security invoker
set search_path = ''
return auth.uid();
revoke execute on function public.devmap_current_user_id() from public, anonymous;
grant execute on function public.devmap_current_user_id() to authenticated;

create policy "devmap_profile_verified_email" on public.devmap_profiles
  as restrictive for all to authenticated
  using (coalesce((select auth.jwt() -> 'emailVerified' = 'true'::jsonb), false))
  with check (coalesce((select auth.jwt() -> 'emailVerified' = 'true'::jsonb), false));

create policy "devmap_workspace_verified_email" on public.devmap_workspaces
  as restrictive for all to authenticated
  using (coalesce((select auth.jwt() -> 'emailVerified' = 'true'::jsonb), false))
  with check (coalesce((select auth.jwt() -> 'emailVerified' = 'true'::jsonb), false));

create or replace function public.devmap_save_workspace(
  expected_user_id uuid,
  expected_revision integer,
  new_payload jsonb
) returns table (new_revision integer, saved_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := public.devmap_current_user_id();
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

insert into devmap_internal.schema_migrations(version) values ('202611050002_verified_email');
