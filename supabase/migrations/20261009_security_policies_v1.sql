-- ATLAS Legalização — Política de Segurança V1
-- Zero Trust, menor privilégio e segregação por organização/perfil.

alter table public.audit_logs enable row level security;
alter table public.briefings enable row level security;
alter table public.client_registry_snapshots enable row level security;
alter table public.client_units enable row level security;
alter table public.communications enable row level security;
alter table public.integration_accounts enable row level security;
alter table public.integration_events enable row level security;

-- Nenhuma tabela empresarial abaixo é acessível ao papel anônimo.
revoke all on table public.audit_logs from anon;
revoke all on table public.briefings from anon;
revoke all on table public.client_registry_snapshots from anon;
revoke all on table public.client_units from anon;
revoke all on table public.communications from anon;
revoke all on table public.integration_accounts from anon;
revoke all on table public.integration_events from anon;
revoke all on table public.processes from anon;

-- Grants mínimos para usuários autenticados.
revoke all on table public.audit_logs from authenticated;
grant select on table public.audit_logs to authenticated;

revoke all on table public.briefings from authenticated;
grant select, insert, update, delete on table public.briefings to authenticated;

revoke all on table public.client_registry_snapshots from authenticated;
grant select, insert on table public.client_registry_snapshots to authenticated;

revoke all on table public.client_units from authenticated;
grant select, insert, update, delete on table public.client_units to authenticated;

revoke all on table public.communications from authenticated;
grant select, insert, update, delete on table public.communications to authenticated;

revoke all on table public.integration_accounts from authenticated;
grant select, insert, update, delete on table public.integration_accounts to authenticated;

revoke all on table public.integration_events from authenticated;
grant select on table public.integration_events to authenticated;

-- Processos nunca são removidos fisicamente pelo frontend. Exclusão é soft-delete via Edge Function.
revoke delete, truncate on table public.processes from authenticated;

-- Bloqueia escalonamento de privilégio: usuário não pode trocar o próprio role/organization/active.
revoke update on table public.profiles from authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- AUDIT LOGS: imutáveis para usuários; leitura apenas Admin/Auditoria da própria organização.
drop policy if exists atlas_audit_logs_select on public.audit_logs;
create policy atlas_audit_logs_select
on public.audit_logs for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_atlas_role() in ('admin','auditoria')
);

-- BRIEFINGS: herdam o escopo e as permissões do processo relacionado.
drop policy if exists atlas_briefings_select on public.briefings;
drop policy if exists atlas_briefings_insert on public.briefings;
drop policy if exists atlas_briefings_update on public.briefings;
drop policy if exists atlas_briefings_delete on public.briefings;

create policy atlas_briefings_select
on public.briefings for select to authenticated
using (
  exists (
    select 1 from public.processes p
    where p.id = briefings.process_id
      and p.organization_id = public.current_org_id()
      and p.deleted_at is null
      and (
        public.current_atlas_role() = 'admin'
        or (public.current_atlas_role() <> 'cliente' and public.has_atlas_permission('processes.view'))
        or (
          public.current_atlas_role() = 'cliente'
          and public.has_atlas_permission('processes.view')
          and p.client_id::text = public.current_client_external_id()
        )
      )
  )
);

create policy atlas_briefings_insert
on public.briefings for insert to authenticated
with check (
  exists (
    select 1 from public.processes p
    where p.id = briefings.process_id
      and p.organization_id = public.current_org_id()
      and p.deleted_at is null
      and public.has_atlas_permission('processes.edit')
  )
);

create policy atlas_briefings_update
on public.briefings for update to authenticated
using (
  exists (
    select 1 from public.processes p
    where p.id = briefings.process_id
      and p.organization_id = public.current_org_id()
      and p.deleted_at is null
      and public.has_atlas_permission('processes.edit')
  )
)
with check (
  exists (
    select 1 from public.processes p
    where p.id = briefings.process_id
      and p.organization_id = public.current_org_id()
      and p.deleted_at is null
      and public.has_atlas_permission('processes.edit')
  )
);

create policy atlas_briefings_delete
on public.briefings for delete to authenticated
using (
  exists (
    select 1 from public.processes p
    where p.id = briefings.process_id
      and p.organization_id = public.current_org_id()
      and public.has_atlas_permission('processes.archive')
  )
);

-- SNAPSHOTS CADASTRAIS: leitura interna e inclusão por quem pode editar empresas; histórico sem UPDATE/DELETE.
drop policy if exists atlas_client_registry_snapshots_select on public.client_registry_snapshots;
drop policy if exists atlas_client_registry_snapshots_insert on public.client_registry_snapshots;

create policy atlas_client_registry_snapshots_select
on public.client_registry_snapshots for select to authenticated
using (
  public.current_atlas_role() <> 'cliente'
  and public.has_atlas_permission('companies.view')
  and exists (
    select 1 from public.clients c
    where c.id = client_registry_snapshots.client_id
      and c.organization_id = public.current_org_id()
      and c.deleted_at is null
  )
);

create policy atlas_client_registry_snapshots_insert
on public.client_registry_snapshots for insert to authenticated
with check (
  public.has_atlas_permission('companies.edit')
  and exists (
    select 1 from public.clients c
    where c.id = client_registry_snapshots.client_id
      and c.organization_id = public.current_org_id()
      and c.deleted_at is null
  )
);

-- UNIDADES: pertencem sempre a uma empresa da organização; cliente vê apenas a própria empresa.
drop policy if exists atlas_client_units_select on public.client_units;
drop policy if exists atlas_client_units_insert on public.client_units;
drop policy if exists atlas_client_units_update on public.client_units;
drop policy if exists atlas_client_units_delete on public.client_units;

create policy atlas_client_units_select
on public.client_units for select to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_units.client_id
      and c.organization_id = public.current_org_id()
      and c.deleted_at is null
      and (
        (public.current_atlas_role() <> 'cliente' and public.has_atlas_permission('companies.view'))
        or (
          public.current_atlas_role() = 'cliente'
          and c.id::text = public.current_client_external_id()
        )
      )
  )
);

create policy atlas_client_units_insert
on public.client_units for insert to authenticated
with check (
  public.has_atlas_permission('companies.edit')
  and exists (
    select 1 from public.clients c
    where c.id = client_units.client_id
      and c.organization_id = public.current_org_id()
      and c.deleted_at is null
  )
);

create policy atlas_client_units_update
on public.client_units for update to authenticated
using (
  public.has_atlas_permission('companies.edit')
  and exists (
    select 1 from public.clients c
    where c.id = client_units.client_id
      and c.organization_id = public.current_org_id()
      and c.deleted_at is null
  )
)
with check (
  public.has_atlas_permission('companies.edit')
  and exists (
    select 1 from public.clients c
    where c.id = client_units.client_id
      and c.organization_id = public.current_org_id()
      and c.deleted_at is null
  )
);

create policy atlas_client_units_delete
on public.client_units for delete to authenticated
using (
  public.has_atlas_permission('companies.edit')
  and exists (
    select 1 from public.clients c
    where c.id = client_units.client_id
      and c.organization_id = public.current_org_id()
  )
);

-- COMUNICAÇÕES: somente Admin, Operação e Auditoria; sempre vinculadas à organização corrente.
drop policy if exists atlas_communications_select on public.communications;
drop policy if exists atlas_communications_insert on public.communications;
drop policy if exists atlas_communications_update on public.communications;
drop policy if exists atlas_communications_delete on public.communications;

create policy atlas_communications_select
on public.communications for select to authenticated
using (
  public.current_atlas_role() in ('admin','operacao','auditoria')
  and (
    (process_id is not null and exists (
      select 1 from public.processes p
      where p.id = communications.process_id
        and p.organization_id = public.current_org_id()
        and p.deleted_at is null
    ))
    or
    (client_id is not null and exists (
      select 1 from public.clients c
      where c.id = communications.client_id
        and c.organization_id = public.current_org_id()
        and c.deleted_at is null
    ))
  )
);

create policy atlas_communications_insert
on public.communications for insert to authenticated
with check (
  public.current_atlas_role() in ('admin','operacao')
  and (
    (process_id is not null and exists (
      select 1 from public.processes p
      where p.id = communications.process_id
        and p.organization_id = public.current_org_id()
        and p.deleted_at is null
    ))
    or
    (client_id is not null and exists (
      select 1 from public.clients c
      where c.id = communications.client_id
        and c.organization_id = public.current_org_id()
        and c.deleted_at is null
    ))
  )
);

create policy atlas_communications_update
on public.communications for update to authenticated
using (
  public.current_atlas_role() in ('admin','operacao')
  and (
    (process_id is not null and exists (
      select 1 from public.processes p
      where p.id = communications.process_id
        and p.organization_id = public.current_org_id()
    ))
    or
    (client_id is not null and exists (
      select 1 from public.clients c
      where c.id = communications.client_id
        and c.organization_id = public.current_org_id()
    ))
  )
)
with check (
  public.current_atlas_role() in ('admin','operacao')
  and (
    (process_id is not null and exists (
      select 1 from public.processes p
      where p.id = communications.process_id
        and p.organization_id = public.current_org_id()
    ))
    or
    (client_id is not null and exists (
      select 1 from public.clients c
      where c.id = communications.client_id
        and c.organization_id = public.current_org_id()
    ))
  )
);

create policy atlas_communications_delete
on public.communications for delete to authenticated
using (
  public.current_atlas_role() in ('admin','operacao')
  and (
    (process_id is not null and exists (
      select 1 from public.processes p
      where p.id = communications.process_id
        and p.organization_id = public.current_org_id()
    ))
    or
    (client_id is not null and exists (
      select 1 from public.clients c
      where c.id = communications.client_id
        and c.organization_id = public.current_org_id()
    ))
  )
);

-- CONTAS DE INTEGRAÇÃO: leitura Admin/Operação; alteração apenas Admin.
drop policy if exists atlas_integration_accounts_select on public.integration_accounts;
drop policy if exists atlas_integration_accounts_insert on public.integration_accounts;
drop policy if exists atlas_integration_accounts_update on public.integration_accounts;
drop policy if exists atlas_integration_accounts_delete on public.integration_accounts;

create policy atlas_integration_accounts_select
on public.integration_accounts for select to authenticated
using (
  organization_id = public.current_org_id()
  and (
    public.current_atlas_role() = 'admin'
    or (public.current_atlas_role() = 'operacao' and public.has_atlas_permission('integrations.view'))
  )
);

create policy atlas_integration_accounts_insert
on public.integration_accounts for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and public.current_atlas_role() = 'admin'
);

create policy atlas_integration_accounts_update
on public.integration_accounts for update to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_atlas_role() = 'admin'
)
with check (
  organization_id = public.current_org_id()
  and public.current_atlas_role() = 'admin'
);

create policy atlas_integration_accounts_delete
on public.integration_accounts for delete to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_atlas_role() = 'admin'
);

-- EVENTOS DE INTEGRAÇÃO: log somente leitura para usuários; escrita fica no backend/service role.
drop policy if exists atlas_integration_events_select on public.integration_events;
create policy atlas_integration_events_select
on public.integration_events for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_atlas_role() in ('admin','operacao','auditoria')
);
