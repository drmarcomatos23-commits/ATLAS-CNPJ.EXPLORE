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
create unique index if not exists idx_atlas_v71_tasks_process_template
  on public.tasks(process_id, task_template_id) where task_template_id is not null;
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

insert into public.role_permissions (organization_id, role, permission_key, enabled, updated_at, updated_by)
select o.id, p.role, p.permission_key, p.enabled, now(), null
from public.organizations o
cross join (
  values
    ('operacao','operations.view',true),('operacao','tasks.view',true),('operacao','tasks.create',true),
    ('operacao','tasks.edit',true),('operacao','tasks.assign',true),('operacao','tasks.complete',true),
    ('operacao','blockers.manage',true),('operacao','workflow.advance',true),('operacao','workflow.override',false),('operacao','teams.manage',false),
    ('financeiro','operations.view',true),('financeiro','tasks.view',true),('financeiro','tasks.create',false),
    ('financeiro','tasks.edit',false),('financeiro','tasks.assign',false),('financeiro','tasks.complete',false),
    ('financeiro','blockers.manage',false),('financeiro','workflow.advance',false),('financeiro','workflow.override',false),('financeiro','teams.manage',false),
    ('auditoria','operations.view',true),('auditoria','tasks.view',true),('auditoria','tasks.create',false),
    ('auditoria','tasks.edit',false),('auditoria','tasks.assign',false),('auditoria','tasks.complete',false),
    ('auditoria','blockers.manage',false),('auditoria','workflow.advance',false),('auditoria','workflow.override',false),('auditoria','teams.manage',false),
    ('cliente','operations.view',false),('cliente','tasks.view',false),('cliente','tasks.create',false),
    ('cliente','tasks.edit',false),('cliente','tasks.assign',false),('cliente','tasks.complete',false),
    ('cliente','blockers.manage',false),('cliente','workflow.advance',false),('cliente','workflow.override',false),('cliente','teams.manage',false)
) as p(role, permission_key, enabled)
on conflict (organization_id, role, permission_key) do nothing;

create or replace function public.atlas_v71_activate_process(p_process_id uuid, p_template_ids uuid[] default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_process public.processes%rowtype;
  v_stage_id uuid;
  v_created integer := 0;
begin
  select * into v_process from public.processes
  where id = p_process_id and organization_id = public.current_org_id() and deleted_at is null;
  if not found then raise exception 'Processo não encontrado'; end if;
  if not public.has_atlas_permission('workflow.advance') then raise exception 'Sem permissão para ativar operação'; end if;

  v_stage_id := v_process.current_stage_id;
  if v_stage_id is null and v_process.workflow_template_id is not null then
    select id into v_stage_id from public.workflow_stages
    where workflow_template_id = v_process.workflow_template_id order by position limit 1;
    update public.processes set current_stage_id = v_stage_id where id = p_process_id;
  end if;
  if v_stage_id is null then raise exception 'Processo sem etapa de workflow'; end if;

  insert into public.process_operations(organization_id,process_id,current_stage_id,stage_started_at,activated_by,updated_at)
  values(v_process.organization_id,p_process_id,v_stage_id,now(),auth.uid(),now())
  on conflict(process_id) do update set current_stage_id=excluded.current_stage_id,updated_at=now();

  with inserted as (
    insert into public.tasks(organization_id,process_id,stage_id,task_template_id,title,description,origin,required,team_id,priority,sla_days,created_by)
    select v_process.organization_id,p_process_id,v_stage_id,tt.id,tt.title,tt.description,'automatic',tt.required,tt.default_team_id,tt.priority,tt.sla_days,auth.uid()
    from public.task_templates tt
    where tt.organization_id=v_process.organization_id and tt.stage_id=v_stage_id and tt.active=true
      and (p_template_ids is null or tt.id=any(p_template_ids))
    on conflict(process_id,task_template_id) where task_template_id is not null do nothing
    returning id,process_id,organization_id
  ), events as (
    insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
    select organization_id,id,process_id,'created',auth.uid(),jsonb_build_object('origin','automatic') from inserted
    returning 1
  ) select count(*) into v_created from inserted;

  insert into public.stage_transitions(organization_id,process_id,from_stage_id,to_stage_id,transition_type,actor_id,metadata)
  values(v_process.organization_id,p_process_id,v_stage_id,v_stage_id,'activation',auth.uid(),jsonb_build_object('generated_tasks',v_created));

  return jsonb_build_object('process_id',p_process_id,'activated',true,'stage_id',v_stage_id,'generated_tasks',v_created);
end;
$$;

create or replace function public.atlas_v71_create_task(
  p_process_id uuid, p_stage_id uuid, p_title text, p_description text, p_required boolean,
  p_priority text, p_assignee_id uuid, p_team_id uuid, p_due_at timestamptz)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_process public.processes%rowtype; v_task public.tasks%rowtype;
begin
  if nullif(btrim(p_title),'') is null then raise exception 'Título da tarefa é obrigatório'; end if;
  select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null;
  if not found then raise exception 'Processo não encontrado'; end if;
  if not public.has_atlas_permission('tasks.create') then raise exception 'Sem permissão para criar tarefa'; end if;
  if not exists(select 1 from public.workflow_stages s where s.id=p_stage_id and s.workflow_template_id=v_process.workflow_template_id) then
    raise exception 'Etapa incompatível com o processo';
  end if;
  insert into public.tasks(organization_id,process_id,stage_id,title,description,origin,required,priority,assignee_id,team_id,due_at,created_by)
  values(v_process.organization_id,p_process_id,p_stage_id,btrim(p_title),nullif(btrim(p_description),''),'manual',coalesce(p_required,false),coalesce(p_priority,'normal'),p_assignee_id,p_team_id,p_due_at,auth.uid())
  returning * into v_task;
  insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
  values(v_process.organization_id,v_task.id,p_process_id,'created',auth.uid(),jsonb_build_object('origin','manual'));
  return to_jsonb(v_task);
end;
$$;

create or replace function public.atlas_v71_set_primary_task(p_process_id uuid, p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_task public.tasks%rowtype;
begin
  if not public.has_atlas_permission('tasks.edit') then raise exception 'Sem permissão para alterar próxima ação'; end if;
  select * into v_task from public.tasks where id=p_task_id and process_id=p_process_id and organization_id=public.current_org_id() and status not in ('completed','cancelled');
  if not found then raise exception 'Tarefa ativa não encontrada'; end if;
  update public.tasks set is_primary_action=false,updated_at=now()
    where process_id=p_process_id and organization_id=v_task.organization_id and is_primary_action=true and id<>p_task_id;
  update public.tasks set is_primary_action=true,updated_at=now() where id=p_task_id;
  insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
  values(v_task.organization_id,p_task_id,p_process_id,'primary_selected',auth.uid(),'{}'::jsonb);
  return jsonb_build_object('process_id',p_process_id,'task_id',p_task_id,'is_primary_action',true);
end;
$$;

create or replace function public.atlas_v71_start_task(p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_task public.tasks%rowtype;
begin
  if not public.has_atlas_permission('tasks.edit') then raise exception 'Sem permissão para iniciar tarefa'; end if;
  update public.tasks set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now()
  where id=p_task_id and organization_id=public.current_org_id() and status not in ('completed','cancelled') returning * into v_task;
  if not found then raise exception 'Tarefa não encontrada ou encerrada'; end if;
  insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
  values(v_task.organization_id,v_task.id,v_task.process_id,'started',auth.uid(),'{}'::jsonb);
  return to_jsonb(v_task);
end;
$$;

create or replace function public.atlas_v71_complete_task(p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_task public.tasks%rowtype;
begin
  if not public.has_atlas_permission('tasks.complete') then raise exception 'Sem permissão para concluir tarefa'; end if;
  update public.tasks set status='completed',started_at=coalesce(started_at,now()),completed_at=now(),completed_by=auth.uid(),is_primary_action=false,updated_at=now()
  where id=p_task_id and organization_id=public.current_org_id() and status not in ('completed','cancelled') returning * into v_task;
  if not found then raise exception 'Tarefa não encontrada ou encerrada'; end if;
  insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
  values(v_task.organization_id,v_task.id,v_task.process_id,'completed',auth.uid(),'{}'::jsonb);
  return to_jsonb(v_task);
end;
$$;

create or replace function public.atlas_v71_open_blocker(p_process_id uuid, p_task_id uuid, p_type text, p_reason text, p_pauses_sla boolean)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_process public.processes%rowtype; v_blocker public.process_blockers%rowtype; v_pause boolean;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'Motivo do bloqueio é obrigatório'; end if;
  if p_type not in ('client','agency','external_finance','third_party','internal') then raise exception 'Tipo de bloqueio inválido'; end if;
  if not public.has_atlas_permission('blockers.manage') then raise exception 'Sem permissão para gerenciar bloqueio'; end if;
  select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null;
  if not found then raise exception 'Processo não encontrado'; end if;
  if p_task_id is not null and not exists(select 1 from public.tasks where id=p_task_id and process_id=p_process_id and organization_id=v_process.organization_id) then
    raise exception 'Tarefa não pertence ao processo';
  end if;
  v_pause := coalesce(p_pauses_sla,false) and p_type <> 'internal';
  insert into public.process_blockers(organization_id,process_id,task_id,blocker_type,reason,pauses_sla,created_by)
  values(v_process.organization_id,p_process_id,p_task_id,p_type,btrim(p_reason),v_pause,auth.uid()) returning * into v_blocker;
  if v_pause then
    insert into public.sla_pauses(organization_id,process_id,stage_id,blocker_id,reason,started_at,classified_by)
    values(v_process.organization_id,p_process_id,v_process.current_stage_id,v_blocker.id,v_blocker.reason,v_blocker.started_at,auth.uid());
  end if;
  if p_task_id is not null then
    update public.tasks set status=case p_type when 'client' then 'waiting_client' when 'agency' then 'waiting_agency' when 'external_finance' then 'waiting_finance' else 'blocked' end,updated_at=now()
    where id=p_task_id;
    insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
    values(v_process.organization_id,p_task_id,p_process_id,'blocked',auth.uid(),jsonb_build_object('blocker_id',v_blocker.id,'type',p_type));
  end if;
  return to_jsonb(v_blocker);
end;
$$;

create or replace function public.atlas_v71_close_blocker(p_blocker_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_blocker public.process_blockers%rowtype;
begin
  if not public.has_atlas_permission('blockers.manage') then raise exception 'Sem permissão para gerenciar bloqueio'; end if;
  select * into v_blocker from public.process_blockers where id=p_blocker_id and organization_id=public.current_org_id();
  if not found then raise exception 'Bloqueio não encontrado'; end if;
  if v_blocker.ended_at is null then
    update public.process_blockers set ended_at=coalesce(ended_at,now()),ended_by=coalesce(ended_by,auth.uid()) where id=p_blocker_id returning * into v_blocker;
    update public.sla_pauses set ended_at=coalesce(ended_at,now()) where blocker_id=p_blocker_id and ended_at is null;
    if v_blocker.task_id is not null then
      update public.tasks set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now()
      where id=v_blocker.task_id and status in ('waiting_client','waiting_agency','waiting_finance','blocked');
      insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
      values(v_blocker.organization_id,v_blocker.task_id,v_blocker.process_id,'unblocked',auth.uid(),jsonb_build_object('blocker_id',p_blocker_id));
    end if;
  end if;
  return to_jsonb(v_blocker);
end;
$$;

create or replace function public.atlas_v71_advance_stage(p_process_id uuid, p_force boolean default false, p_justification text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_process public.processes%rowtype;
  v_current public.workflow_stages%rowtype;
  v_next public.workflow_stages%rowtype;
  v_pending integer;
  v_created integer := 0;
  v_type text;
begin
  select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null;
  if not found then raise exception 'Processo não encontrado'; end if;
  if not public.has_atlas_permission('workflow.advance') then raise exception 'Sem permissão para avançar etapa'; end if;
  if p_force and nullif(btrim(p_justification),'') is null then raise exception 'Justificativa obrigatória para avanço forçado'; end if;
  if p_force and not public.has_atlas_permission('workflow.override') then raise exception 'Sem permissão para avanço forçado'; end if;

  select * into v_current from public.workflow_stages where id=v_process.current_stage_id;
  if not found then raise exception 'Etapa atual não encontrada'; end if;
  select count(*) into v_pending from public.tasks t
    where t.process_id=p_process_id and t.stage_id=v_current.id and t.required = true and t.status not in ('completed','cancelled');
  if v_pending > 0 and not p_force then raise exception 'Existem % tarefas obrigatórias pendentes',v_pending; end if;

  select * into v_next from public.workflow_stages
    where workflow_template_id=v_current.workflow_template_id and position>v_current.position order by position limit 1;
  if not found then raise exception 'Processo já está na etapa final'; end if;

  v_type := case when p_force then 'forced' else 'normal' end;
  update public.processes set current_stage_id=v_next.id,status=case when lower(v_next.name) like 'conclu%' then 'completed' else 'in_progress' end where id=p_process_id;
  update public.process_operations set current_stage_id=v_next.id,stage_started_at=now(),updated_at=now() where process_id=p_process_id;

  insert into public.stage_transitions(organization_id,process_id,from_stage_id,to_stage_id,transition_type,justification,actor_id,metadata)
  values(v_process.organization_id,p_process_id,v_current.id,v_next.id,v_type,nullif(btrim(p_justification),''),auth.uid(),jsonb_build_object('pending_required_at_transition',v_pending));

  with inserted as (
    insert into public.tasks(organization_id,process_id,stage_id,task_template_id,title,description,origin,required,team_id,priority,sla_days,created_by)
    select v_process.organization_id,p_process_id,v_next.id,tt.id,tt.title,tt.description,'automatic',tt.required,tt.default_team_id,tt.priority,tt.sla_days,auth.uid()
    from public.task_templates tt
    where tt.organization_id=v_process.organization_id and tt.stage_id=v_next.id and tt.active=true
    on conflict(process_id,task_template_id) where task_template_id is not null do nothing
    returning id,process_id,organization_id
  ), events as (
    insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
    select organization_id,id,process_id,'created',auth.uid(),jsonb_build_object('origin','automatic','stage_id',v_next.id) from inserted
    returning 1
  ) select count(*) into v_created from inserted;

  return jsonb_build_object('process_id',p_process_id,'from_stage_id',v_current.id,'to_stage_id',v_next.id,'transition_type',v_type,'generated_tasks',v_created);
end;
$$;

revoke all on function public.atlas_v71_activate_process(uuid,uuid[]) from public, anon;
revoke all on function public.atlas_v71_create_task(uuid,uuid,text,text,boolean,text,uuid,uuid,timestamptz) from public, anon;
revoke all on function public.atlas_v71_set_primary_task(uuid,uuid) from public, anon;
revoke all on function public.atlas_v71_start_task(uuid) from public, anon;
revoke all on function public.atlas_v71_complete_task(uuid) from public, anon;
revoke all on function public.atlas_v71_open_blocker(uuid,uuid,text,text,boolean) from public, anon;
revoke all on function public.atlas_v71_close_blocker(uuid) from public, anon;
revoke all on function public.atlas_v71_advance_stage(uuid,boolean,text) from public, anon;
grant execute on function public.atlas_v71_activate_process(uuid,uuid[]) to authenticated;
grant execute on function public.atlas_v71_create_task(uuid,uuid,text,text,boolean,text,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.atlas_v71_set_primary_task(uuid,uuid) to authenticated;
grant execute on function public.atlas_v71_start_task(uuid) to authenticated;
grant execute on function public.atlas_v71_complete_task(uuid) to authenticated;
grant execute on function public.atlas_v71_open_blocker(uuid,uuid,text,text,boolean) to authenticated;
grant execute on function public.atlas_v71_close_blocker(uuid) to authenticated;
grant execute on function public.atlas_v71_advance_stage(uuid,boolean,text) to authenticated;
