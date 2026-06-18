-- Read-only share links for plans.
--
-- A share is a bearer capability: the unguessable `token` authorizes anonymous
-- read access to ONE plan (or one snapshot). Owners manage their own shares
-- under RLS; the public read path runs server-side with the service role AFTER
-- validating the token, so there is deliberately NO anon RLS policy here —
-- other plans stay invisible.

create table if not exists public.plan_shares (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.plans (id) on delete cascade,
  owner_id       uuid not null references auth.users (id) on delete cascade,
  token          text not null unique,
  scope          text not null default 'view'
                 check (scope in ('view', 'find-seat')),
  source         text not null default 'live'
                 check (source in ('live', 'snapshot')),
  snapshot_id    uuid references public.plan_snapshots (id) on delete cascade,
  label          text not null default '',
  show_dietary   boolean not null default false,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists plan_shares_plan_id_idx on public.plan_shares (plan_id);
create index if not exists plan_shares_owner_id_idx on public.plan_shares (owner_id);
create unique index if not exists plan_shares_token_idx on public.plan_shares (token);

grant select, insert, update, delete on public.plan_shares to authenticated;

-- The public read path resolves a token and loads the shared plan with the
-- service-role client (bypassing RLS). Grant it the privileges it needs to
-- read shares + the referenced plan/snapshot and to bump the view counter.
grant select, update on public.plan_shares to service_role;
grant select on public.plans to service_role;
grant select on public.plan_snapshots to service_role;

alter table public.plan_shares enable row level security;

-- Owners manage only their own shares. No anon policy by design — public reads
-- use the service-role client after server-side token validation.
create policy "shares_select_own" on public.plan_shares
  for select using (owner_id = auth.uid());
create policy "shares_insert_own" on public.plan_shares
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid())
  );
create policy "shares_update_own" on public.plan_shares
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "shares_delete_own" on public.plan_shares
  for delete using (owner_id = auth.uid());
