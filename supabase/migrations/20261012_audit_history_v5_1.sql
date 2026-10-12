-- ATLAS Legalização V5.1 — Histórico e auditoria operacional
-- Registra alterações das entidades centrais em public.audit_logs sem conceder escrita ao frontend.

create schema if not exists atlas_private;

create or replace function atlas_private.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  row_data jsonb;
  previous_data jsonb;
  audit_org_id uuid;
  audit_client_id uuid;
  audit_process_id uuid;
  audit_action text;
  audit_entity_id text;
  audit_label text;
  changed_fields jsonb := '[]'::jsonb;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    previous_data := to_jsonb(old);
    audit_action := 'deleted';
  elsif tg_op = 'INSERT' then
    row_data := to_jsonb(new);
    previous_data := '{}'::jsonb;
    audit_action := 'created';
  else
    row_data := to_jsonb(new);
    previous_data := to_jsonb(old);
    audit_action := 'updated';
  end if;

  audit_entity_id := nullif(row_data ->> 'id', '');
  audit_org_id := nullif(row_data ->> 'organization_id', '')::uuid;
  audit_client_id := nullif(row_data ->> 'client_id', '')::uuid;
  audit_process_id := nullif(row_data ->> 'process_id', '')::uuid;

  -- Custos pertencem ao processo e licenças pertencem à empresa. Resolve o escopo
  -- no banco para que cada evento sempre carregue organization_id e client_id.
  if audit_process_id is not null and (audit_org_id is null or audit_client_id is null) then
    select p.organization_id, p.client_id
      into audit_org_id, audit_client_id
    from public.processes p
    where p.id = audit_process_id;
  end if;

  if audit_client_id is not null and audit_org_id is null then
    select c.organization_id
      into audit_org_id
    from public.clients c
    where c.id = audit_client_id;
  end if;

  -- Para a própria empresa, o id da entidade é o client_id do histórico.
  if tg_table_name = 'clients' then
    audit_client_id := nullif(row_data ->> 'id', '')::uuid;
  end if;

  if audit_org_id is null then
    return coalesce(new, old);
  end if;

  audit_label := coalesce(
    nullif(row_data ->> 'legal_name', ''),
    nullif(row_data ->> 'title', ''),
    nullif(row_data ->> 'name', ''),
    nullif(row_data ->> 'description', ''),
    nullif(row_data ->> 'full_name', ''),
    audit_entity_id,
    tg_table_name
  );

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(keys.key order by keys.key), '[]'::jsonb)
      into changed_fields
    from (
      select key
      from jsonb_object_keys(row_data || previous_data) as key
      where row_data -> key is distinct from previous_data -> key
        and key not in ('updated_at')
    ) as keys;
  elsif tg_op = 'INSERT' then
    changed_fields := '[]'::jsonb;
  else
    changed_fields := '[]'::jsonb;
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    audit_org_id,
    auth.uid(),
    audit_action,
    tg_table_name,
    audit_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'client_id', audit_client_id,
      'process_id', audit_process_id,
      'label', audit_label,
      'changed_fields', changed_fields
    ))
  );

  return coalesce(new, old);
end;
$$;

-- Trigger function is internal: users do not call it directly.
revoke all on function atlas_private.capture_audit_log() from public;
revoke all on function atlas_private.capture_audit_log() from anon;
revoke all on function atlas_private.capture_audit_log() from authenticated;

-- Índice específico para o histórico da Empresa 360°.
create index if not exists idx_audit_logs_client_date
  on public.audit_logs ((payload ->> 'client_id'), created_at desc);

drop trigger if exists atlas_audit_clients on public.clients;
create trigger atlas_audit_clients
after insert or update or delete on public.clients
for each row execute function atlas_private.capture_audit_log();

drop trigger if exists atlas_audit_processes on public.processes;
create trigger atlas_audit_processes
after insert or update or delete on public.processes
for each row execute function atlas_private.capture_audit_log();

drop trigger if exists atlas_audit_costs on public.costs;
create trigger atlas_audit_costs
after insert or update or delete on public.costs
for each row execute function atlas_private.capture_audit_log();

drop trigger if exists atlas_audit_licenses on public.licenses;
create trigger atlas_audit_licenses
after insert or update or delete on public.licenses
for each row execute function atlas_private.capture_audit_log();

drop trigger if exists atlas_audit_documents on public.documents;
create trigger atlas_audit_documents
after insert or update or delete on public.documents
for each row execute function atlas_private.capture_audit_log();

drop trigger if exists atlas_audit_client_partners on public.client_partners;
create trigger atlas_audit_client_partners
after insert or update or delete on public.client_partners
for each row execute function atlas_private.capture_audit_log();
