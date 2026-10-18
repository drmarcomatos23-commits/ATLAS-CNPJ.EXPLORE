-- Ambiente efêmero de CI. Objetos mínimos para executar as duas migrations 7.1.
-- Não executar este fixture no Supabase de produção.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('atlas_test.user_id', true),'')::uuid $$;

create table public.organizations (
 id uuid primary key,
 name text
);
create table public.profiles (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 full_name text,
 role text,
 active boolean default true
);
create table public.clients (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 legal_name text,
 state text,
 city text,
 deleted_at timestamptz
);
create table public.workflow_templates (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 name text
);
create table public.workflow_stages (
 id uuid primary key,
 workflow_template_id uuid references public.workflow_templates(id),
 position integer,
 name text,
 sla_days integer
);
create table public.processes (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 client_id uuid references public.clients(id),
 workflow_template_id uuid references public.workflow_templates(id),
 current_stage_id uuid references public.workflow_stages(id),
 status text default 'open',
 service_type text,
 started_at timestamptz default now(),
 deleted_at timestamptz
);
create table public.documents (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 process_id uuid references public.processes(id),
 client_id uuid references public.clients(id),
 name text not null,
 storage_key text not null,
 category text,
 created_at timestamptz default now()
);
create table public.role_permissions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 role text not null,
 permission_key text not null,
 enabled boolean not null,
 updated_at timestamptz,
 updated_by uuid references public.profiles(id),
 unique (organization_id,role,permission_key)
);

create function public.current_org_id() returns uuid language sql stable
  as $$ select nullif(current_setting('atlas_test.org_id',true),'')::uuid $$;
create function public.current_atlas_role() returns text language sql stable
  as $$ select nullif(current_setting('atlas_test.role',true),'') $$;
create function public.has_atlas_permission(p_key text) returns boolean language sql stable
  as $$ select current_setting('atlas_test.role',true)='admin' OR
          coalesce((select enabled from public.role_permissions where
          organization_id=public.current_org_id() and role=public.current_atlas_role()
          and permission_key=p_key),false) $$;

-- Base tables are organization-scoped, matching Supabase client isolation.
alter table public.processes enable row level security;
alter table public.clients enable row level security;
alter table public.documents enable row level security;
alter table public.profiles enable row level security;
create policy b_process on public.processes to authenticated using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy b_clients on public.clients to authenticated using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy b_documents on public.documents to authenticated using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy b_profiles on public.profiles to authenticated using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

grant usage on schema public,auth to authenticated;
grant execute on all functions in schema public,auth to authenticated;
grant select,insert,update on public.processes,public.clients,public.documents,public.profiles to authenticated;
grant select on public.organizations,public.workflow_stages,public.workflow_templates to authenticated;

-- Org, actor e clientes artificiais; nenhuma informação real de cliente.
insert into public.organizations (id,name) values
 ('11111111-1111-4111-8111-111111111111','Homologação'),
 ('22222222-2222-4222-8222-222222222222','Outra organização');
insert into public.profiles (id,organization_id,full_name,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Admin de teste','admin'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Pessoa de outra organização','operacao');
insert into public.clients(id,organization_id,legal_name,state,city) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Cliente sintético','SP','Santos');
insert into public.workflow_templates(id,organization_id,name) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Abertura empresarial');
insert into public.workflow_stages(id,workflow_template_id,position,name,sla_days) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,'Briefing',2),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd',2,'Viabilidade',5);
insert into public.processes(id,organization_id,client_id,workflow_template_id,current_stage_id,service_type,status) values
 ('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','abertura','open');

-- GUC set by authenticated JWT adapter; only in the CI fixture.
select set_config('atlas_test.org_id','11111111-1111-4111-8111-111111111111',false);
select set_config('atlas_test.user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('atlas_test.role','admin',false);
