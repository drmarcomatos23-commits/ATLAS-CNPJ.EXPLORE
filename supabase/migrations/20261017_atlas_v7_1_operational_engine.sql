-- ATLAS Legalização 7.1 — Motor Operacional
-- Source-only until an isolated database is explicitly authorized for homologation.

create table if not exists public.process_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  current_stage_id uuid references public.workflow_stages(id),
  stage_started_at timestamptz not null default now(),
  activated_at timestamptz not null default now(),
  activated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (process_id)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_template_id uuid not null references public.workflow_templates(id) on delete cascade,
  stage_id uuid not null references public.workflow_stages(id) on delete cascade,
  title text not null,
  description text,
  required boolean not null default true,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  default_team_id uuid references public.teams(id),
  sla_days integer check (sla_days is null or sla_days >= 0),
  suggested_order integer not null default 0,
  primary_eligible boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  stage_id uuid not null references public.workflow_stages(id),
  task_template_id uuid references public.task_templates(id),
  title text not null,
  description text,
  origin text not null default 'manual' check (origin in ('automatic','manual')),
  required boolean not null default false,
  is_primary_action boolean not null default false,
  assignee_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  status text not null default 'pending' check (status in ('pending','in_progress','waiting_client','waiting_agency','waiting_finance','blocked','completed','cancelled')),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  sla_days integer check (sla_days is null or sla_days >= 0),
  created_by uuid references public.profiles(id),
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.process_blockers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  blocker_type text not null check (blocker_type in ('client','agency','external_finance','third_party','internal')),
  reason text not null,
  pauses_sla boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(id),
  ended_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.sla_pauses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  stage_id uuid references public.workflow_stages(id),
  blocker_id uuid not null references public.process_blockers(id) on delete cascade,
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  classified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  from_stage_id uuid references public.workflow_stages(id),
  to_stage_id uuid references public.workflow_stages(id),
  transition_type text not null default 'normal' check (transition_type in ('activation','normal','forced','reopened')),
  justification text,
  actor_id uuid references public.profiles(id),
  transitioned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.business_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  scope text not null default 'organization' check (scope in ('national','state','municipal','organization')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, holiday_date, name)
);

create unique index if not exists idx_atlas_v71_tasks_one_active_primary
  on public.tasks(process_id)
  where is_primary_action = true and status not in ('completed','cancelled');
create index if not exists idx_atlas_v71_tasks_organization_id on public.tasks(organization_id);
create index if not exists idx_atlas_v71_tasks_process_id on public.tasks(process_id);
create index if not exists idx_atlas_v71_tasks_status on public.tasks(status);
create index if not exists idx_atlas_v71_tasks_due_at on public.tasks(due_at);
create index if not exists idx_atlas_v71_tasks_assignee on public.tasks(assignee_id, status);
create index if not exists idx_atlas_v71_tasks_team on public.tasks(team_id, status);
create index if not exists idx_atlas_v71_task_templates_stage on public.task_templates(stage_id, active, suggested_order);
create index if not exists idx_atlas_v71_task_events_process on public.task_events(process_id, created_at desc);
create index if not exists idx_atlas_v71_blockers_process on public.process_blockers(process_id, ended_at);
create index if not exists idx_atlas_v71_pauses_process on public.sla_pauses(process_id, started_at);
create index if not exists idx_atlas_v71_transitions_process on public.stage_transitions(process_id, transitioned_at desc);
create index if not exists idx_atlas_v71_holidays_org_date on public.business_holidays(organization_id, holiday_date);

alter table public.process_operations enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.task_templates enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_events enable row level security;
alter table public.process_blockers enable row level security;
alter table public.sla_pauses enable row level security;
alter table public.stage_transitions enable row level security;
alter table public.business_holidays enable row level security;

revoke all on table public.process_operations from anon;
revoke all on table public.teams from anon;
revoke all on table public.team_members from anon;
revoke all on table public.task_templates from anon;
revoke all on table public.tasks from anon;
revoke all on table public.task_dependencies from anon;
revoke all on table public.task_events from anon;
revoke all on table public.process_blockers from anon;
revoke all on table public.sla_pauses from anon;
revoke all on table public.stage_transitions from anon;
revoke all on table public.business_holidays from anon;

revoke all on table public.process_operations from authenticated;
revoke all on table public.teams from authenticated;
revoke all on table public.team_members from authenticated;
revoke all on table public.task_templates from authenticated;
revoke all on table public.tasks from authenticated;
revoke all on table public.task_dependencies from authenticated;
revoke all on table public.task_events from authenticated;
revoke all on table public.process_blockers from authenticated;
revoke all on table public.sla_pauses from authenticated;
revoke all on table public.stage_transitions from authenticated;
revoke all on table public.business_holidays from authenticated;

grant select, insert, update on table public.process_operations to authenticated;
grant select, insert, update, delete on table public.teams to authenticated;
grant select, insert, update, delete on table public.team_members to authenticated;
grant select, insert, update, delete on table public.task_templates to authenticated;
grant select, insert, update on table public.tasks to authenticated;
grant select, insert, delete on table public.task_dependencies to authenticated;
grant select, insert on table public.task_events to authenticated;
grant select, insert, update on table public.process_blockers to authenticated;
grant select, insert, update on table public.sla_pauses to authenticated;
grant select, insert on table public.stage_transitions to authenticated;
grant select, insert, update, delete on table public.business_holidays to authenticated;

-- Direct organization boundary. Mutation permissions are further restricted by per-table policies and RPCs.
do $$
declare t text;
begin
  foreach t in array array['process_operations','teams','team_members','task_templates','tasks','task_dependencies','task_events','process_blockers','sla_pauses','stage_transitions','business_holidays']
  loop
    execute format('drop policy if exists atlas_v71_%I_select on public.%I', t, t);
    execute format('create policy atlas_v71_%I_select on public.%I for select to authenticated using (organization_id = public.current_org_id())', t, t);
  end loop;
end $$;

create policy atlas_v71_process_operations_write on public.process_operations
  for all to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('workflow.advance'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('workflow.advance'));

create policy atlas_v71_teams_write on public.teams
  for all to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('teams.manage'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('teams.manage'));
create policy atlas_v71_team_members_write on public.team_members
  for all to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('teams.manage'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('teams.manage'));
create policy atlas_v71_task_templates_write on public.task_templates
  for all to authenticated
  using (organization_id = public.current_org_id() and public.current_atlas_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_atlas_role() = 'admin');

create policy atlas_v71_tasks_insert on public.tasks
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('tasks.create'));
create policy atlas_v71_tasks_update on public.tasks
  for update to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('tasks.edit'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('tasks.edit'));
create policy atlas_v71_task_dependencies_write on public.task_dependencies
  for all to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('tasks.edit'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('tasks.edit'));
create policy atlas_v71_task_events_insert on public.task_events
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('tasks.edit'));
create policy atlas_v71_blockers_write on public.process_blockers
  for all to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('blockers.manage'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('blockers.manage'));
create policy atlas_v71_sla_pauses_write on public.sla_pauses
  for all to authenticated
  using (organization_id = public.current_org_id() and public.has_atlas_permission('blockers.manage'))
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('blockers.manage'));
create policy atlas_v71_stage_transitions_insert on public.stage_transitions
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.has_atlas_permission('workflow.advance'));
create policy atlas_v71_holidays_write on public.business_holidays
  for all to authenticated
  using (organization_id = public.current_org_id() and public.current_atlas_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_atlas_role() = 'admin');

-- Default permission vocabulary. Admin remains unconditional in the client permission guard.
insert into public.role_permissions (organization_id, role, permission_key, enabled, updated_at, updated_by)
select o.id, p.role, p.permission_key, p.enabled, now(), null
from public.organizations o
cross join (
  values
    ('operacao','operations.view',true),
    ('operacao','tasks.view',true),
    ('operacao','tasks.create',true),
    ('operacao','tasks.edit',true),
    ('operacao','tasks.assign',true),
    ('operacao','tasks.complete',true),
    ('operacao','blockers.manage',true),
    ('operacao','workflow.advance',true),
    ('operacao','workflow.override',false),
    ('operacao','teams.manage',false),
    ('financeiro','operations.view',true),
    ('financeiro','tasks.view',true),
    ('financeiro','tasks.create',false),
    ('financeiro','tasks.edit',false),
    ('financeiro','tasks.assign',false),
    ('financeiro','tasks.complete',false),
    ('financeiro','blockers.manage',false),
    ('financeiro','workflow.advance',false),
    ('financeiro','workflow.override',false),
    ('financeiro','teams.manage',false),
    ('auditoria','operations.view',true),
    ('auditoria','tasks.view',true),
    ('auditoria','tasks.create',false),
    ('auditoria','tasks.edit',false),
    ('auditoria','tasks.assign',false),
    ('auditoria','tasks.complete',false),
    ('auditoria','blockers.manage',false),
    ('auditoria','workflow.advance',false),
    ('auditoria','workflow.override',false),
    ('auditoria','teams.manage',false),
    ('cliente','operations.view',false),
    ('cliente','tasks.view',false),
    ('cliente','tasks.create',false),
    ('cliente','tasks.edit',false),
    ('cliente','tasks.assign',false),
    ('cliente','tasks.complete',false),
    ('cliente','blockers.manage',false),
    ('cliente','workflow.advance',false),
    ('cliente','workflow.override',false),
    ('cliente','teams.manage',false)
) as p(role, permission_key, enabled)
on conflict (organization_id, role, permission_key) do nothing;
