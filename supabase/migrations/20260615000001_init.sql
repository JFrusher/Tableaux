-- Tableaux SaaS schema.
--
-- One plan document per wedding, owned by an authenticated user. Tenant
-- isolation is enforced by Row-Level Security (owner_id = auth.uid()) at the
-- database layer, so a bug in application code cannot leak another user's plan.

create extension if not exists pgcrypto;

-- ── plans ────────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Our Wedding',
  doc         jsonb not null default '{}'::jsonb,
  rev         integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists plans_owner_id_idx on public.plans (owner_id);

-- ── plan_snapshots ───────────────────────────────────────────────────────────
-- Snapshots live in their own table (not inside the plan document) so saving a
-- plan never re-serialises every snapshot blob.
create table if not exists public.plan_snapshots (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Untitled snapshot',
  doc         jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists plan_snapshots_plan_id_idx on public.plan_snapshots (plan_id);
create index if not exists plan_snapshots_owner_id_idx on public.plan_snapshots (owner_id);

-- ── updated_at + rev maintenance ──────────────────────────────────────────────
-- The database owns `rev`: any change to the document bumps it. Clients send the
-- rev they last read and a write is rejected (0 rows) if it no longer matches —
-- optimistic concurrency that prevents last-write-wins clobbering.
create or replace function public.touch_plan()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.doc is distinct from old.doc then
    new.rev := old.rev + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch
  before update on public.plans
  for each row execute function public.touch_plan();

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Table-level privileges for the signed-in role. RLS (below) still restricts
-- which *rows* each user can touch; grants permit table access at all.
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, delete on public.plan_snapshots to authenticated;

-- ── Row-Level Security ─────────────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.plan_snapshots enable row level security;

create policy "plans_select_own" on public.plans
  for select using (owner_id = auth.uid());
create policy "plans_insert_own" on public.plans
  for insert with check (owner_id = auth.uid());
create policy "plans_update_own" on public.plans
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "plans_delete_own" on public.plans
  for delete using (owner_id = auth.uid());

create policy "snapshots_select_own" on public.plan_snapshots
  for select using (owner_id = auth.uid());
create policy "snapshots_insert_own" on public.plan_snapshots
  for insert with check (owner_id = auth.uid());
create policy "snapshots_delete_own" on public.plan_snapshots
  for delete using (owner_id = auth.uid());
