-- ATLAS V7.2 — fonte versionada, NÃO executar na base de produção sem autorização.
-- Depende, em ordem, das migrations v7.1 operational_engine e document_exigencies.
-- Preserva documentos, histórico, exigências, custos e tarefas existentes.

alter table public.document_requirement_templates
 add column if not exists scope_legal_nature text,
 add column if not exists scope_activity text;

alter table public.process_document_requirements
 add column if not exists applicability text not null default 'to_confirm',
 add column if not exists pending_with text,
 add column if not exists assigned_to uuid references public.profiles(id),
 add column if not exists notes text,
 add column if not exists requested_at timestamptz,
 add column if not exists received_at timestamptz,
 add column if not exists resolved_at timestamptz,
 add column if not exists archived_at timestamptz,
 add column if not exists service_type_snapshot text,
 add column if not exists manual_key uuid;

-- Migrar estados antigos ANTES de instalar o novo conjunto de valores.
alter table public.process_document_requirements
 drop constraint if exists process_document_requirements_status_check;
update public.process_document_requirements
 set status=case status
   when 'pending' then 'not_requested'
   when 'submitted' then 'received'
   when 'rejected' then 'returned'
   else status end;
alter table public.process_document_requirements
 alter column status set default 'not_requested';

update public.process_document_requirements r set
 service_type_snapshot=coalesce(r.service_type_snapshot,p.service_type),
 applicability=case when r.required_rule='conditional' then 'to_confirm' else 'applicable' end,
 pending_with=case when r.status in ('approved','waived','not_requested') then null else coalesce(r.pending_with,'operacao') end,
 requested_at=case when r.status in ('requested','received','in_review','returned') then coalesce(r.requested_at,r.created_at) else r.requested_at end,
 received_at=case when r.status in ('received','in_review','approved','returned') then coalesce(r.received_at,r.created_at) else r.received_at end,
 resolved_at=case when r.status in ('approved','waived') then coalesce(r.resolved_at,r.reviewed_at,r.updated_at) else r.resolved_at end,
 review_notes=case when r.status='returned' and nullif(trim(coalesce(r.review_notes,'')),'') is null then 'Revisão histórica — confirmar motivo' else r.review_notes end
 from public.processes p where p.id=r.process_id;

alter table public.process_document_requirements
 add constraint v72_doc_req_status_check check (status in ('not_requested','requested','received','in_review','approved','returned','waived')),
 add constraint v72_doc_req_applicability_check check (applicability in ('to_confirm','applicable','not_applicable')),
 add constraint v72_doc_req_pending_with_check check (pending_with is null or pending_with in ('cliente','financeiro','orgao','operacao')),
 add constraint v72_doc_req_return_reason_check check (status <> 'returned' or nullif(trim(coalesce(review_notes,'')),'') is not null),
 add constraint v72_doc_req_approved_evidence_check check (status <> 'approved' or (document_id is not null and reviewed_by is not null)),
 add constraint v72_doc_req_pending_owner_check check (status not in ('requested','received','in_review','returned') or pending_with is not null);

create index if not exists idx_v72_doc_req_pending
 on public.process_document_requirements(organization_id,process_id,pending_with,status,due_on);
create unique index if not exists uq_v72_doc_manual_key
 on public.process_document_requirements(process_id,manual_key) where manual_key is not null;

-- Modelos iniciais configuráveis por serviço, todos condicionais até conferência
-- das exigências do órgão, município, atividade e natureza jurídica do cliente.
insert into public.document_requirement_templates
 (organization_id,service_type,title,instructions,category,required_rule,sort_order)
select o.id,v.service_type,v.title,v.instructions,v.category,'conditional',v.sort_order
from public.organizations o cross join (values
 ('abertura','Qualificação dos sócios e administradores','Dados de representação e assinatura.','Pessoal',10),
 ('abertura','Documentos de identificação dos signatários','Conferir órgão e natureza jurídica.','Pessoal',11),
 ('abertura','CNAEs e descrição do objeto social','Atividades e riscos.','Societário',12),
 ('abertura','Minuta do ato constitutivo','Capital, quotas e administração.','Societário',13),
 ('alteracao_societaria','Contrato e alterações registrados','Conferir ato em vigor.','Societário',10),
 ('alteracao_societaria','Qualificação e representação de signatários','Identificação e poderes.','Pessoal',11),
 ('alteracao_societaria','Alterações de capital, quotas ou administração','Aplicar somente aos eventos pertinentes.','Societário',12),
 ('alteracao_societaria','Viabilidade da alteração','Quando nome, endereço ou atividade exigirem.','Registro',13),
 ('regularizacao','CNPJ e atos vigentes','Identificar pessoa jurídica.','Societário',10),
 ('regularizacao','Auto, intimação ou apontamento do órgão','Origem do procedimento.','Órgão',11),
 ('regularizacao','Histórico de protocolos e respostas','Reunir comprovantes anteriores.','Protocolo',12),
 ('regularizacao','Comprovantes fiscais ou de pagamentos','Conforme irregularidade.','Fiscal',13),
 ('regularizacao','Procuração ou autorização','Quando houver representação.','Pessoal',14),
 ('licenciamento','CNPJ e contrato social vigente','Identificação da atividade.','Societário',10),
 ('licenciamento','Documentação do imóvel','Conferir inscrição e endereço.','Imóvel',11),
 ('licenciamento','CNAEs e atividade no local','Detalhar risco e uso.','Atividade',12),
 ('licenciamento','Laudos, projetos e ART/RRT','Se exigido.','Técnico',13),
 ('licenciamento','Licenças e alvarás anteriores','Quando existentes.','Licença',14),
 ('baixa','CNPJ e último ato registrado','Identificação.','Societário',10),
 ('baixa','Distrato social ou ato de extinção','Conforme tipo jurídico.','Societário',11),
 ('baixa','Identificação dos signatários','Poderes e representação.','Pessoal',12),
 ('baixa','Comprovantes de baixa cadastral','Eventos na Redesim.','Registro',13),
 ('baixa','Baixa de inscrições e licenças','Conforme inscrições existentes.','Órgão',14),
 ('encerramento','CNPJ e atos constitutivos','Registros mais recentes.','Societário',10),
 ('encerramento','Distrato social ou ato de extinção','Conforme tipo jurídico.','Societário',11),
 ('encerramento','Identificação dos signatários','Poderes e representação.','Pessoal',12),
 ('encerramento','Comprovantes fiscais e cadastrais','Situação a encerrar.','Fiscal',13),
 ('encerramento','Protocolos de baixa dos órgãos','Acompanhar exigências.','Órgão',14),
 ('encerramento','Baixa de inscrições e licenças','Quando pertinentes.','Licença',15),
 ('legalizacao_empresarial','CNPJ e contrato social vigente','Quando empresa já constituída.','Societário',10),
 ('legalizacao_empresarial','Identificação e representação','Responsáveis e procuradores.','Pessoal',11),
 ('legalizacao_empresarial','Endereço e documentação do imóvel','Conforme localidade.','Imóvel',12),
 ('legalizacao_empresarial','Atividades e CNAEs','Descrição e riscos.','Atividade',13),
 ('legalizacao_empresarial','Viabilidade e protocolos','Quando aplicáveis.','Órgão',14),
 ('legalizacao_empresarial','Inscrições, licenças e alvarás','Conforme atividade.','Licença',15)
) v(service_type,title,instructions,category,sort_order)
where not exists(select 1 from public.document_requirement_templates existing
 where existing.organization_id=o.id and existing.service_type=v.service_type and existing.title=v.title);

-- A trigger v7.1 já valida arquivo/requisito/processo. Complementar com responsável
-- interno na MESMA organização, inclusive quando a tabela é atualizada diretamente.
create or replace function public.atlas_v71_document_validate_links()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_org uuid;
begin
 select organization_id into v_org from public.processes where id=new.process_id and deleted_at is null;
 if v_org is distinct from new.organization_id or v_org is distinct from public.current_org_id() then
  raise exception 'Processo ou organização inválidos';
 end if;
 if tg_table_name='process_document_requirements' then
  if tg_op='INSERT' and new.created_by is not null and new.created_by is distinct from auth.uid() then
   raise exception 'Criador documental não corresponde à sessão'; end if;
  if tg_op='UPDATE' then
   if (new.reviewed_by is distinct from old.reviewed_by or
      (new.status is distinct from old.status and new.status in ('approved','returned','waived','in_review')))
     and new.reviewed_by is distinct from auth.uid() then
    raise exception 'Revisor documental não corresponde à sessão'; end if;
  end if;
  if new.template_id is not null and not exists (
   select 1 from public.document_requirement_templates where id=new.template_id and organization_id=v_org
  ) then raise exception 'Modelo documental de outra organização'; end if;
  if new.document_id is not null and not exists (
   select 1 from public.documents where id=new.document_id and process_id=new.process_id and organization_id=v_org
  ) then raise exception 'Documento do requisito não pertence ao processo'; end if;
  if new.assigned_to is not null and not exists (
   select 1 from public.profiles where id=new.assigned_to and organization_id=v_org and active=true
  ) then raise exception 'Responsável de outra organização ou inativo'; end if;
 elsif tg_table_name='process_document_versions' then
  if not exists (select 1 from public.process_document_requirements where id=new.requirement_id and process_id=new.process_id and organization_id=v_org)
   or not exists (select 1 from public.documents where id=new.document_id and process_id=new.process_id and organization_id=v_org)
  then raise exception 'Arquivo ou requisito incompatível com processo'; end if;
 elsif tg_table_name='process_exigencies' then
  if new.notice_document_id is not null and not exists (
   select 1 from public.documents where id=new.notice_document_id and process_id=new.process_id and organization_id=v_org
  ) then raise exception 'Notificação não vinculada ao processo'; end if;
 elsif tg_table_name='process_exigency_evidence' then
  if not exists (select 1 from public.process_exigencies where id=new.exigency_id and process_id=new.process_id and organization_id=v_org)
   or not exists (select 1 from public.documents where id=new.document_id and process_id=new.process_id and organization_id=v_org)
  then raise exception 'Evidência incompatível com processo'; end if;
 end if;
 return new;
end $$;

-- Eventos transacionais são imutáveis e não dependem de JS no navegador.
create or replace function public.atlas_v71_document_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_requirement_id uuid; v_exigency_id uuid; v_payload jsonb;
begin
 if tg_op='DELETE' then return old; end if;
 if tg_table_name='process_document_requirements' then
  v_requirement_id:=new.id;
  v_payload:=jsonb_build_object('record_id',new.id,'before',case when tg_op='UPDATE' then jsonb_build_object(
   'status',old.status,'pending_with',old.pending_with,'assigned_to',old.assigned_to,
   'due_on',old.due_on,'applicability',old.applicability,'archived_at',old.archived_at) else null end,
   'after',jsonb_build_object('status',new.status,'pending_with',new.pending_with,
    'assigned_to',new.assigned_to,'due_on',new.due_on,'applicability',new.applicability,'archived_at',new.archived_at));
 elsif tg_table_name='process_document_versions' then
  v_requirement_id:=new.requirement_id;
  v_payload:=jsonb_build_object('record_id',new.id,'revision',new.revision,'document_id',new.document_id);
 elsif tg_table_name='process_exigencies' then
  v_exigency_id:=new.id;
  v_payload:=jsonb_build_object('record_id',new.id,'status',new.status);
 elsif tg_table_name='process_exigency_evidence' then
  v_exigency_id:=new.exigency_id;
  v_payload:=jsonb_build_object('record_id',new.id,'document_id',new.document_id);
 end if;
 insert into public.process_document_events(organization_id,process_id,requirement_id,exigency_id,event_type,actor_id,payload)
 values(new.organization_id,new.process_id,v_requirement_id,v_exigency_id,
        tg_table_name||'.'||lower(tg_op),auth.uid(),coalesce(v_payload,'{}'::jsonb));
 return new;
end $$;
revoke all on function public.atlas_v71_document_audit() from public,anon,authenticated;

-- Sem acesso direto de cliente ao checklist; visualizar é permissão granular.
drop policy if exists v71_doc_requirement_write on public.process_document_requirements;
create policy v72_doc_requirement_insert on public.process_document_requirements for insert to authenticated
 with check (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente'
  and (public.has_atlas_permission('documents.review') or public.has_atlas_permission('processes.create')));
create policy v72_doc_requirement_update on public.process_document_requirements for update to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente' and public.has_atlas_permission('documents.review'))
 with check (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente' and public.has_atlas_permission('documents.review'));
drop policy if exists v71_doc_v72_read on public.process_document_requirements;
create policy v71_doc_v72_read on public.process_document_requirements for select to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente' and
  (public.has_atlas_permission('documents.view') or public.has_atlas_permission('documents.review')
    or public.has_atlas_permission('processes.create')));
-- Remover a política de leitura geral anterior, que permitiria bypass por OR.
drop policy if exists v71_doc_process_document_requirements_read on public.process_document_requirements;
drop policy if exists v71_doc_document_requirement_templates_read on public.document_requirement_templates;
drop policy if exists v71_doc_process_document_versions_read on public.process_document_versions;
drop policy if exists v71_doc_process_document_events_read on public.process_document_events;
drop policy if exists v71_doc_process_exigencies_read on public.process_exigencies;
drop policy if exists v71_doc_process_exigency_evidence_read on public.process_exigency_evidence;
create policy v72_doc_template_read on public.document_requirement_templates for select to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente'
  and (public.has_atlas_permission('documents.view') or public.has_atlas_permission('documents.review') or public.has_atlas_permission('processes.create')));
create policy v72_doc_versions_read on public.process_document_versions for select to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente' and
  (public.has_atlas_permission('documents.view') or public.has_atlas_permission('documents.review')));
create policy v72_doc_events_read on public.process_document_events for select to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente' and
  (public.has_atlas_permission('documents.view') or public.has_atlas_permission('documents.review')));
create policy v72_exigency_read on public.process_exigencies for select to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente'
  and (public.has_atlas_permission('documents.view') or public.has_atlas_permission('documents.review') or public.has_atlas_permission('exigencies.manage')));
create policy v72_exigency_evidence_read on public.process_exigency_evidence for select to authenticated
 using (organization_id=public.current_org_id() and public.current_atlas_role()<>'cliente'
  and (public.has_atlas_permission('documents.view') or public.has_atlas_permission('documents.review') or public.has_atlas_permission('exigencies.manage')));

-- Auditoria e financeiro consultam pendências, sem adquirir poder de aprovação.
-- Preservar configurações preexistentes: somente acrescentar defaults ausentes.
insert into public.role_permissions(organization_id,role,permission_key,enabled,updated_at)
select o.id,p.role,p.permission_key,p.enabled,now()
from public.organizations o cross join (values
 ('operacao','documents.view',true),
 ('financeiro','documents.view',true),
 ('auditoria','documents.view',true),
 ('cliente','documents.view',false)
) p(role,permission_key,enabled)
on conflict(organization_id,role,permission_key) do nothing;

create or replace function public.atlas_v72_init_document_checklist(p_process_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare v_process public.processes%rowtype; v_count integer;
begin
 if not (public.has_atlas_permission('processes.create') or public.has_atlas_permission('documents.review')) then
  raise exception 'Sem permissão de configuração documental'; end if;
 select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null for update;
 if not found then raise exception 'Processo não encontrado'; end if;
 insert into public.process_document_requirements
 (organization_id,process_id,template_id,stage_id,title,instructions,category,required_rule,
  applicability,service_type_snapshot,created_by)
 select v_process.organization_id,v_process.id,t.id,t.stage_id,t.title,t.instructions,t.category,t.required_rule,
  case when t.required_rule='conditional' then 'to_confirm' else 'applicable' end,
  v_process.service_type,auth.uid()
 from public.document_requirement_templates t
 left join public.clients c on c.id=v_process.client_id
 where t.organization_id=v_process.organization_id and t.active
  and t.service_type=v_process.service_type
  and (t.stage_id is null or t.stage_id=v_process.current_stage_id)
  and (t.scope_state is null or upper(t.scope_state)=upper(c.state))
  and (t.scope_city is null or lower(t.scope_city)=lower(c.city))
 on conflict (process_id,template_id) do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end $$;

create or replace function public.atlas_v72_update_requirement(p_requirement_id uuid,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_req public.process_document_requirements%rowtype; v_new_status text;
 v_origin text; v_assignee uuid; v_due date; v_note text; v_app text; v_reason text;
begin
 if not public.has_atlas_permission('documents.review') then raise exception 'Sem permissão de conferência'; end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Atualização inválida'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) as k where k not in
  ('status','pending_with','assigned_to','due_on','notes','applicability','reason')) then
  raise exception 'Campo não autorizado'; end if;
 select * into v_req from public.process_document_requirements
 where id=p_requirement_id and organization_id=public.current_org_id() and archived_at is null for update;
 if not found then raise exception 'Requisito não encontrado'; end if;
 v_new_status:=coalesce(p_patch->>'status',v_req.status);
 if v_new_status not in ('not_requested','requested','received','in_review','approved','returned','waived') then raise exception 'Estado inválido'; end if;
 v_origin:=case when p_patch ? 'pending_with' then nullif(p_patch->>'pending_with','') else v_req.pending_with end;
 v_assignee:=case when p_patch ? 'assigned_to' then nullif(p_patch->>'assigned_to','')::uuid else v_req.assigned_to end;
 v_due:=case when p_patch ? 'due_on' then nullif(p_patch->>'due_on','')::date else v_req.due_on end;
 v_note:=case when p_patch ? 'notes' then p_patch->>'notes' else v_req.notes end;
 v_app:=case when p_patch ? 'applicability' then p_patch->>'applicability' else v_req.applicability end;
 v_reason:=nullif(trim(coalesce(p_patch->>'reason','')),'');
 if v_origin is not null and v_origin not in ('cliente','financeiro','orgao','operacao') then raise exception 'Origem inválida'; end if;
 if v_app not in ('to_confirm','applicable','not_applicable') then raise exception 'Aplicabilidade inválida'; end if;
 if v_new_status='received' and v_req.document_id is null and nullif(trim(coalesce(v_note,'')),'') is null then
  raise exception 'Informe recebimento físico em observações ou anexe documento'; end if;
 if v_new_status in ('approved','in_review') and v_req.document_id is null then raise exception 'Evidência obrigatória'; end if;
 if v_new_status in ('returned','waived') and v_reason is null then raise exception 'Justificativa obrigatória'; end if;
 if v_new_status in ('requested','received','in_review','returned') and v_origin is null then raise exception 'Informe com quem está pendente'; end if;
 if v_new_status in ('approved','waived','not_requested') then v_origin:=null; end if;
 if v_app='not_applicable' and v_new_status<>'waived' then raise exception 'Dispense formalmente item não aplicável'; end if;
 update public.process_document_requirements set
  status=v_new_status,pending_with=v_origin,assigned_to=v_assignee,due_on=v_due,notes=v_note,applicability=v_app,
  waiver_reason=case when v_new_status='waived' then v_reason else null end,
  review_notes=case when v_new_status='returned' then v_reason when v_new_status in ('approved','in_review') then coalesce(v_reason,review_notes) else review_notes end,
  reviewed_by=case when v_new_status in ('approved','returned','waived','in_review') then auth.uid() else null end,
  reviewed_at=case when v_new_status in ('approved','returned','waived','in_review') then now() else null end,
  requested_at=case when v_new_status='requested' and v_req.status<>'requested' then now() else requested_at end,
  received_at=case when v_new_status='received' and v_req.status<>'received' then now() else received_at end,
  resolved_at=case when v_new_status in ('approved','waived') then now() else null end,
  updated_at=now()
 where id=v_req.id returning * into v_req;
 return to_jsonb(v_req);
end $$;

create or replace function public.atlas_v72_add_manual_requirement(
 p_process_id uuid,p_title text,p_required_rule text default 'conditional',p_manual_key uuid default null,
 p_instructions text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_process public.processes%rowtype; v_id uuid;
begin
 if not public.has_atlas_permission('documents.review') then raise exception 'Sem permissão de inclusão'; end if;
 if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'Título obrigatório'; end if;
 if p_required_rule not in ('required','conditional','optional') then raise exception 'Regra inválida'; end if;
 select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null for update;
 if not found then raise exception 'Processo não encontrado'; end if;
 insert into public.process_document_requirements
 (organization_id,process_id,title,instructions,required_rule,applicability,manual_key,service_type_snapshot,created_by)
 values(v_process.organization_id,v_process.id,trim(p_title),
  nullif(trim(coalesce(p_instructions,'')),''),p_required_rule,
  case when p_required_rule='conditional' then 'to_confirm' else 'applicable' end,
  p_manual_key,v_process.service_type,auth.uid())
 on conflict (process_id,manual_key) where manual_key is not null do nothing returning id into v_id;
 if v_id is null and p_manual_key is not null then
  select id into v_id from public.process_document_requirements where process_id=p_process_id and manual_key=p_manual_key;
 end if;
 return v_id;
end $$;

create or replace function public.atlas_v72_reconcile_checklist(p_process_id uuid,p_service_type text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_process public.processes%rowtype; v_old text; v_archived integer; v_added integer;
begin
 if not public.has_atlas_permission('processes.edit') or not public.has_atlas_permission('documents.review') then
  raise exception 'Sem permissão para alterar serviço'; end if;
 if p_service_type not in ('abertura','alteracao_societaria','regularizacao','licenciamento','baixa','encerramento','legalizacao_empresarial') then
  raise exception 'Serviço sem modelo configurado'; end if;
 select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null for update;
 if not found then raise exception 'Processo não encontrado'; end if;
 v_old:=v_process.service_type;
 if v_old is distinct from p_service_type then
  update public.process_document_requirements set archived_at=now(),updated_at=now()
  where process_id=p_process_id and organization_id=v_process.organization_id
   and archived_at is null and service_type_snapshot is distinct from p_service_type;
  get diagnostics v_archived=row_count;
  update public.processes set service_type=p_service_type where id=p_process_id;
  update public.process_document_requirements set archived_at=null,updated_at=now()
   where process_id=p_process_id and service_type_snapshot=p_service_type and archived_at is not null;
 else v_archived:=0; end if;
 v_added:=public.atlas_v72_init_document_checklist(p_process_id);
 return jsonb_build_object('process_id',p_process_id,'old_service',v_old,'new_service',p_service_type,'archived',v_archived,'added',v_added);
end $$;

-- Manter as RPCs legadas usadas pelo Dossiê, agora com estados canônicos.
create or replace function public.atlas_v71_add_document_version(p_requirement_id uuid,p_document_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare v_req public.process_document_requirements%rowtype; v_version integer;
begin
 if not public.has_atlas_permission('documents.upload') then raise exception 'Sem permissão para anexar documento'; end if;
 select * into v_req from public.process_document_requirements where id=p_requirement_id
  and organization_id=public.current_org_id() and archived_at is null for update;
 if not found then raise exception 'Requisito não encontrado'; end if;
 if not exists(select 1 from public.documents where id=p_document_id and organization_id=v_req.organization_id and process_id=v_req.process_id) then
  raise exception 'Arquivo deve pertencer ao processo'; end if;
 select coalesce(max(revision),0)+1 into v_version from public.process_document_versions where requirement_id=p_requirement_id;
 insert into public.process_document_versions(organization_id,process_id,requirement_id,document_id,revision,created_by)
 values(v_req.organization_id,v_req.process_id,v_req.id,p_document_id,v_version,auth.uid());
 update public.process_document_requirements set document_id=p_document_id,status='received',received_at=now(),
  pending_with='operacao',reviewed_by=null,reviewed_at=null,review_notes=null,updated_at=now()
 where id=p_requirement_id;
 return v_version;
end $$;

create or replace function public.atlas_v71_review_document(p_requirement_id uuid,p_decision text,p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_state text;
begin
 v_state:=case p_decision when 'pending' then 'not_requested' when 'submitted' then 'received'
  when 'rejected' then 'returned' else p_decision end;
 return public.atlas_v72_update_requirement(p_requirement_id,jsonb_build_object('status',v_state,'reason',p_notes,
  'pending_with',case when v_state='returned' then 'cliente' when v_state in ('approved','waived','not_requested') then null else 'operacao' end));
end $$;

revoke all on function public.atlas_v72_init_document_checklist(uuid) from public,anon;
revoke all on function public.atlas_v72_update_requirement(uuid,jsonb) from public,anon;
revoke all on function public.atlas_v72_add_manual_requirement(uuid,text,text,uuid,text) from public,anon;
revoke all on function public.atlas_v72_reconcile_checklist(uuid,text) from public,anon;
grant execute on function public.atlas_v72_init_document_checklist(uuid) to authenticated;
grant execute on function public.atlas_v72_update_requirement(uuid,jsonb) to authenticated;
grant execute on function public.atlas_v72_add_manual_requirement(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.atlas_v72_reconcile_checklist(uuid,text) to authenticated;

-- Pendências passam a ser fotografadas em stage_transitions, nunca exceções.
create or replace function public.atlas_v71_advance_stage(p_process_id uuid,p_force boolean default false,p_justification text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_process public.processes%rowtype; v_current public.workflow_stages%rowtype;
 v_next public.workflow_stages%rowtype; v_pending integer; v_doc_pending integer;
 v_exigency_pending integer; v_cost_pending integer; v_created integer:=0; v_doc_created integer:=0;
begin
 if not public.has_atlas_permission('workflow.advance') then raise exception 'Sem permissão para avançar etapa'; end if;
 if p_force and not public.has_atlas_permission('workflow.override') then raise exception 'Sem permissão para avanço legado forçado'; end if;
 select * into v_process from public.processes where id=p_process_id
  and organization_id=public.current_org_id() and deleted_at is null for update;
 if not found then raise exception 'Processo não encontrado'; end if;
 select * into v_current from public.workflow_stages where id=v_process.current_stage_id;
 if not found then raise exception 'Etapa atual não encontrada'; end if;
 select * into v_next from public.workflow_stages where workflow_template_id=v_current.workflow_template_id
  and position>v_current.position order by position limit 1;
 if not found then raise exception 'Processo já está na etapa final'; end if;

 select count(*) into v_pending from public.tasks t where t.process_id=p_process_id
  and t.stage_id=v_current.id and t.required=true and t.status not in ('completed','cancelled');
 select count(*) into v_doc_pending from public.process_document_requirements d
  where d.process_id=p_process_id and d.archived_at is null and d.required_rule='required'
  and d.status not in ('approved','waived') and (d.stage_id is null or d.stage_id=v_current.id);
 select count(*) into v_exigency_pending from public.process_exigencies x where x.process_id=p_process_id
  and x.status not in ('accepted','cancelled');
 select count(*) into v_cost_pending from public.costs c where c.process_id=p_process_id
  and lower(coalesce(c.payment_status,'pending')) not in ('paid','pago','quitado','received','recebido','cancelled','cancelado');

 -- Garante o guard v7.1 de avanço autenticado, sem alterar pendências existentes.
 perform set_config('atlas_v71.stage_transition','approved',true);
 update public.processes set current_stage_id=v_next.id,
  status=case when lower(v_next.name) like 'conclu%' then 'completed' else 'in_progress' end where id=p_process_id;
 update public.process_operations set current_stage_id=v_next.id,stage_started_at=now(),updated_at=now() where process_id=p_process_id;
 insert into public.stage_transitions(organization_id,process_id,from_stage_id,to_stage_id,transition_type,justification,actor_id,metadata)
 values(v_process.organization_id,p_process_id,v_current.id,v_next.id,'normal',nullif(trim(coalesce(p_justification,'')),''),auth.uid(),
  jsonb_build_object('advisory_only',true,'pending_at_transition',jsonb_build_object(
   'tasks',v_pending,'documents',v_doc_pending,'exigencies',v_exigency_pending,'costs',v_cost_pending)));

 with inserted as (
  insert into public.tasks(organization_id,process_id,stage_id,task_template_id,title,description,origin,required,team_id,priority,sla_days,created_by)
  select v_process.organization_id,p_process_id,v_next.id,tt.id,tt.title,tt.description,'automatic',tt.required,
   tt.default_team_id,tt.priority,tt.sla_days,auth.uid()
  from public.task_templates tt where tt.organization_id=v_process.organization_id and tt.stage_id=v_next.id and tt.active=true
  on conflict(process_id,task_template_id) where task_template_id is not null do nothing returning id,process_id,organization_id
 ), events as (
  insert into public.task_events(organization_id,task_id,process_id,event_type,actor_id,payload)
  select organization_id,id,process_id,'created',auth.uid(),jsonb_build_object('origin','automatic','stage_id',v_next.id) from inserted returning 1
 ) select count(*) into v_created from inserted;

 insert into public.process_document_requirements
  (organization_id,process_id,template_id,stage_id,title,instructions,category,required_rule,
   applicability,service_type_snapshot,created_by)
 select v_process.organization_id,p_process_id,t.id,t.stage_id,t.title,t.instructions,t.category,t.required_rule,
  case when t.required_rule='conditional' then 'to_confirm' else 'applicable' end,
  v_process.service_type,auth.uid()
 from public.document_requirement_templates t
 left join public.clients c on c.id=v_process.client_id
 where t.organization_id=v_process.organization_id and t.service_type=v_process.service_type and t.stage_id=v_next.id
  and t.active=true and (t.scope_state is null or upper(t.scope_state)=upper(c.state))
  and (t.scope_city is null or lower(t.scope_city)=lower(c.city))
 on conflict(process_id,template_id) do nothing;
 get diagnostics v_doc_created=row_count;
 return jsonb_build_object('process_id',p_process_id,'from_stage_id',v_current.id,'to_stage_id',v_next.id,
  'pending_tasks',v_pending,'pending_documents',v_doc_pending,'pending_exigencies',v_exigency_pending,
  'pending_costs',v_cost_pending,'generated_tasks',v_created,'generated_document_requirements',v_doc_created);
end $$;
