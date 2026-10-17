-- ATLAS 7.1 — Documentos, checklist e exigências formais
-- SOURCE ONLY. Executar exclusivamente em ambiente de homologação aprovado.
-- Não modifica nem exclui arquivos da tabela documents ou do Storage existente.

create table if not exists public.document_requirement_templates (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 service_type text not null,
 stage_id uuid references public.workflow_stages(id),
 scope_state text,
 scope_city text,
 title text not null,
 instructions text,
 required_rule text not null default 'conditional'
   check(required_rule in ('required','conditional','optional')),
 category text not null default 'Outros',
 sort_order integer not null default 0,
 active boolean not null default true,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_v71_doc_template_scope on public.document_requirement_templates
 (organization_id,service_type,active,stage_id);

create table if not exists public.process_document_requirements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 process_id uuid not null references public.processes(id) on delete cascade,
 template_id uuid references public.document_requirement_templates(id) on delete set null,
 stage_id uuid references public.workflow_stages(id),
 title text not null,
 instructions text,
 category text not null default 'Outros',
 required_rule text not null default 'conditional'
   check(required_rule in ('required','conditional','optional')),
 status text not null default 'pending'
   check(status in ('pending','submitted','in_review','approved','rejected','waived')),
 document_id uuid references public.documents(id) on delete set null,
 waiver_reason text,
 review_notes text,
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 due_on date,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(process_id,template_id),
 check (status <> 'waived' or nullif(trim(waiver_reason),'') is not null),
 check (status not in ('approved','rejected') or reviewed_by is not null)
);
create index if not exists idx_v71_doc_req_process on public.process_document_requirements(process_id,status);
create index if not exists idx_v71_doc_req_org on public.process_document_requirements(organization_id);

create table if not exists public.process_document_versions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 process_id uuid not null references public.processes(id) on delete cascade,
 requirement_id uuid not null references public.process_document_requirements(id) on delete cascade,
 document_id uuid not null references public.documents(id) on delete restrict,
 revision integer not null check(revision>0),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(requirement_id,revision),
 unique(requirement_id,document_id)
);

create table if not exists public.process_exigencies (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 process_id uuid not null references public.processes(id) on delete cascade,
 stage_id uuid references public.workflow_stages(id),
 agency text not null,
 protocol_number text,
 title text not null,
 description text not null,
 received_on date not null default current_date,
 due_on date,
 status text not null default 'open'
   check(status in ('open','in_progress','responded','accepted','reopened','cancelled')),
 assigned_to uuid references public.profiles(id),
 notice_document_id uuid references public.documents(id),
 response_protocol text,
 response_summary text,
 responded_at timestamptz,
 accepted_at timestamptz,
 accepted_by uuid references public.profiles(id),
 acceptance_notes text,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (status <> 'accepted' or (responded_at is not null and accepted_at is not null)),
 check (status <> 'responded' or responded_at is not null)
);
create index if not exists idx_v71_exigency_process on public.process_exigencies(process_id,status,due_on);
create index if not exists idx_v71_exigency_org on public.process_exigencies(organization_id);

create table if not exists public.process_exigency_evidence (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 process_id uuid not null references public.processes(id) on delete cascade,
 exigency_id uuid not null references public.process_exigencies(id) on delete cascade,
 document_id uuid not null references public.documents(id) on delete restrict,
 evidence_kind text not null default 'response' check(evidence_kind in ('notice','response','complement')),
 uploaded_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(exigency_id,document_id,evidence_kind)
);

create table if not exists public.process_document_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 process_id uuid not null references public.processes(id) on delete cascade,
 requirement_id uuid references public.process_document_requirements(id) on delete set null,
 exigency_id uuid references public.process_exigencies(id) on delete set null,
 event_type text not null,
 actor_id uuid references public.profiles(id),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists idx_v71_document_events_process on public.process_document_events(process_id,created_at desc);

-- Dados só podem ser lidos na própria organização; administrador define templates.
do $$
declare t text;
begin
 foreach t in array array['document_requirement_templates','process_document_requirements',
 'process_document_versions','process_exigencies','process_exigency_evidence','process_document_events']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('revoke all on public.%I from authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy v71_doc_%I_read on public.%I for select to authenticated using (organization_id = public.current_org_id())',t,t);
 end loop;
end $$;

grant insert,update on public.document_requirement_templates to authenticated;
grant insert,update on public.process_document_requirements to authenticated;
grant insert on public.process_document_versions to authenticated;
grant insert,update on public.process_exigencies to authenticated;
grant insert on public.process_exigency_evidence to authenticated;
-- Events only through the audit trigger. Never grant direct write.
create policy v71_doc_template_write on public.document_requirement_templates for all to authenticated
 using (organization_id = public.current_org_id() and public.has_atlas_permission('documents.templates.manage'))
 with check (organization_id = public.current_org_id() and public.has_atlas_permission('documents.templates.manage'));
create policy v71_doc_requirement_write on public.process_document_requirements for all to authenticated
 using (organization_id = public.current_org_id() and public.has_atlas_permission('documents.review'))
 with check (organization_id = public.current_org_id() and public.has_atlas_permission('documents.review'));
create policy v71_doc_version_write on public.process_document_versions for insert to authenticated
 with check (organization_id = public.current_org_id() and public.has_atlas_permission('documents.upload'));
create policy v71_exigency_write on public.process_exigencies for all to authenticated
 using (organization_id = public.current_org_id() and public.has_atlas_permission('exigencies.manage'))
 with check (organization_id = public.current_org_id() and public.has_atlas_permission('exigencies.manage'));
create policy v71_exigency_evidence_write on public.process_exigency_evidence for insert to authenticated
 with check (organization_id = public.current_org_id() and public.has_atlas_permission('exigencies.manage'));

-- O vínculo organizacional é validado no banco, não apenas pela interface.
create or replace function public.atlas_v71_document_validate_links()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_org uuid;
begin
 select organization_id into v_org from public.processes where id=new.process_id and deleted_at is null;
 if v_org is distinct from new.organization_id or v_org is distinct from public.current_org_id() then
  raise exception 'Processo ou organização inválidos';
 end if;
 if tg_table_name='process_document_requirements' and new.template_id is not null and
    not exists(select 1 from public.document_requirement_templates where id=new.template_id and organization_id=v_org) then
  raise exception 'Modelo documental de outra organização';
 end if;
 if tg_table_name='process_document_versions' and
    not exists(select 1 from public.process_document_requirements where id=new.requirement_id and process_id=new.process_id and organization_id=v_org) then
  raise exception 'Requisito incompatível com o processo';
 end if;
 if tg_table_name='process_exigency_evidence' and
    not exists(select 1 from public.process_exigencies where id=new.exigency_id and process_id=new.process_id and organization_id=v_org) then
  raise exception 'Exigência incompatível com o processo';
 end if;
 if tg_table_name in ('process_document_versions','process_exigency_evidence') and
    not exists(select 1 from public.documents where id=new.document_id and process_id=new.process_id and organization_id=v_org) then
  raise exception 'Documento não vinculado ao mesmo processo';
 end if;
 if tg_table_name='process_exigencies' and new.notice_document_id is not null and
    not exists(select 1 from public.documents where id=new.notice_document_id and process_id=new.process_id and organization_id=v_org) then
  raise exception 'Notificação não vinculada ao processo';
 end if;
 return new;
end $$;
create trigger v71_doc_requirement_links before insert or update on public.process_document_requirements
 for each row execute function public.atlas_v71_document_validate_links();
create trigger v71_doc_version_links before insert on public.process_document_versions
 for each row execute function public.atlas_v71_document_validate_links();
create trigger v71_exigency_links before insert or update on public.process_exigencies
 for each row execute function public.atlas_v71_document_validate_links();
create trigger v71_exigency_evidence_links before insert on public.process_exigency_evidence
 for each row execute function public.atlas_v71_document_validate_links();

-- Auditoria originada por trigger, preenchendo actor_id a partir da sessão.
create or replace function public.atlas_v71_document_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_row record;
begin
 if tg_op='DELETE' then return old; end if;
 v_row:=new;
 insert into public.process_document_events(organization_id,process_id,requirement_id,exigency_id,event_type,actor_id,payload)
 values(new.organization_id,new.process_id,
  case when tg_table_name='process_document_requirements' then new.id
       when tg_table_name='process_document_versions' then new.requirement_id else null end,
  case when tg_table_name='process_exigencies' then new.id
       when tg_table_name='process_exigency_evidence' then new.exigency_id else null end,
  tg_table_name||'.'||lower(tg_op),auth.uid(),
  jsonb_build_object('record_id',new.id));
 return new;
end $$;
revoke all on function public.atlas_v71_document_audit() from public,anon,authenticated;
create trigger v71_doc_requirement_audit after insert or update on public.process_document_requirements
 for each row execute function public.atlas_v71_document_audit();
create trigger v71_doc_version_audit after insert on public.process_document_versions
 for each row execute function public.atlas_v71_document_audit();
create trigger v71_exigency_audit after insert or update on public.process_exigencies
 for each row execute function public.atlas_v71_document_audit();
create trigger v71_exigency_evidence_audit after insert on public.process_exigency_evidence
 for each row execute function public.atlas_v71_document_audit();

insert into public.role_permissions(organization_id,role,permission_key,enabled,updated_at,updated_by)
select o.id, p.role,p.permission_key,p.enabled,now(),null from public.organizations o cross join
(values
 ('operacao','documents.review',true),('operacao','documents.templates.manage',false),('operacao','exigencies.manage',true),
 ('financeiro','documents.review',false),('financeiro','documents.templates.manage',false),('financeiro','exigencies.manage',false),
 ('auditoria','documents.review',false),('auditoria','documents.templates.manage',false),('auditoria','exigencies.manage',false),
 ('cliente','documents.review',false),('cliente','documents.templates.manage',false),('cliente','exigencies.manage',false)
) p(role,permission_key,enabled)
on conflict(organization_id,role,permission_key) do nothing;

-- Exemplos iniciais, sujeitos a revisão técnica por serviço/órgão.
-- "conditional" não equivale a obrigação legal universal.
insert into public.document_requirement_templates
 (organization_id,service_type,title,instructions,category,required_rule,sort_order)
select o.id,v.service_type,v.title,v.instructions,v.category,'conditional',v.ord
from public.organizations o cross join (values
 ('abertura','Identificação dos sócios','Conforme natureza jurídica e exigências da junta/órgão competente.','Documento pessoal',1),
 ('abertura','Informações e comprovação do endereço','Conforme município, uso do imóvel e natureza da atividade.','Comprovante',2),
 ('abertura','Procuração / representação','Quando houver representação por procurador.','Societário',3),
 ('abertura','Documentação de atividade regulamentada','Quando houver exigência setorial.','Licença',4),
 ('alteracao_societaria','Instrumento da alteração societária','Conferir assinaturas, quadro societário e atos vinculados.','Societário',1),
 ('alteracao_societaria','Documentos de representação','Conforme operação e signatários.','Documento pessoal',2),
 ('baixa','Comprovantes de encerramento','Conforme competências fiscal, registral e municipal.','Fiscal',1),
 ('regularizacao','Documentos da irregularidade','Indicar órgão, pendência e exigências específicas.','Fiscal',1),
 ('licenciamento','Documentação específica da licença','Verificar CNAE, risco, imóvel, município e órgão licenciador.','Licença',1),
 ('legalizacao_empresarial','Documentos para briefing','Confirmar documentos aplicáveis antes do protocolo.','Societário',1)
) v(service_type,title,instructions,category,ord)
where not exists(select 1 from public.document_requirement_templates t
 where t.organization_id=o.id and t.service_type=v.service_type and t.title=v.title);

create or replace function public.atlas_v71_init_document_checklist(p_process_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare v_process public.processes%rowtype; v_count integer;
begin
 if not (public.has_atlas_permission('processes.create') or public.has_atlas_permission('documents.review')) then
  raise exception 'Sem permissão de configuração documental';
 end if;
 select * into v_process from public.processes where id=p_process_id
 and organization_id=public.current_org_id() and deleted_at is null;
 if not found then raise exception 'Processo não encontrado'; end if;
 insert into public.process_document_requirements
 (organization_id,process_id,template_id,stage_id,title,instructions,category,required_rule,created_by)
 select v_process.organization_id,v_process.id,t.id,t.stage_id,t.title,t.instructions,t.category,t.required_rule,auth.uid()
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

create or replace function public.atlas_v71_add_document_version(p_requirement_id uuid,p_document_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare v_req public.process_document_requirements%rowtype; v_version integer;
begin
 if not public.has_atlas_permission('documents.upload') then raise exception 'Sem permissão para anexar documento'; end if;
 select * into v_req from public.process_document_requirements
 where id=p_requirement_id and organization_id=public.current_org_id() for update;
 if not found then raise exception 'Requisito não encontrado'; end if;
 if not exists(select 1 from public.documents d where d.id=p_document_id
 and d.organization_id=v_req.organization_id and d.process_id=v_req.process_id) then
  raise exception 'Arquivo deve pertencer ao processo'; end if;
 select coalesce(max(revision),0)+1 into v_version from public.process_document_versions
 where requirement_id=v_req.id;
 insert into public.process_document_versions
 (organization_id,process_id,requirement_id,document_id,revision,created_by)
 values(v_req.organization_id,v_req.process_id,v_req.id,p_document_id,v_version,auth.uid());
 -- A confirmação de envio não aprova o conteúdo.
 update public.process_document_requirements
 set document_id=p_document_id,status='submitted',reviewed_by=null,reviewed_at=null,
 review_notes=null,updated_at=now()
 where id=v_req.id;
 return v_version;
end $$;

create or replace function public.atlas_v71_review_document(
 p_requirement_id uuid,p_decision text,p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_req public.process_document_requirements%rowtype;
begin
 if not public.has_atlas_permission('documents.review') then raise exception 'Sem permissão para conferir documento'; end if;
 if p_decision not in ('approved','rejected','in_review','waived','pending') then raise exception 'Decisão inválida'; end if;
 select * into v_req from public.process_document_requirements
 where id=p_requirement_id and organization_id=public.current_org_id() for update;
 if not found then raise exception 'Requisito não encontrado'; end if;
 if p_decision in ('approved','rejected','in_review') and v_req.document_id is null then
  raise exception 'Nenhum documento anexado';
 end if;
 if p_decision in ('rejected','waived') and nullif(trim(coalesce(p_notes,'')),'') is null then
  raise exception 'Justificativa obrigatória';
 end if;
 update public.process_document_requirements set status=p_decision,
 waiver_reason=case when p_decision='waived' then p_notes else null end,
 review_notes=case when p_decision in ('approved','rejected','in_review') then p_notes else null end,
 reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=p_requirement_id returning * into v_req;
 return to_jsonb(v_req);
end $$;

create or replace function public.atlas_v71_create_exigency(
 p_process_id uuid,p_agency text,p_title text,p_description text,
 p_protocol_number text default null,p_received_on date default current_date,
 p_due_on date default null,p_assigned_to uuid default null,p_notice_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_process public.processes%rowtype;v_e public.process_exigencies%rowtype;
begin
 if not public.has_atlas_permission('exigencies.manage') then raise exception 'Sem permissão para exigências'; end if;
 if nullif(trim(p_agency),'') is null or nullif(trim(p_title),'') is null or nullif(trim(p_description),'') is null
 then raise exception 'Órgão, título e descrição são obrigatórios'; end if;
 select * into v_process from public.processes where id=p_process_id and organization_id=public.current_org_id() and deleted_at is null;
 if not found then raise exception 'Processo não encontrado'; end if;
 insert into public.process_exigencies(organization_id,process_id,stage_id,agency,title,description,
 protocol_number,received_on,due_on,assigned_to,notice_document_id,created_by)
 values(v_process.organization_id,v_process.id,v_process.current_stage_id,p_agency,p_title,p_description,
 nullif(trim(p_protocol_number),''),p_received_on,p_due_on,p_assigned_to,p_notice_document_id,auth.uid())
 returning * into v_e;
 return to_jsonb(v_e);
end $$;

create or replace function public.atlas_v71_mark_exigency_responded(
 p_exigency_id uuid,p_document_id uuid,p_response_protocol text default null,p_summary text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_e public.process_exigencies%rowtype;
begin
 if not public.has_atlas_permission('exigencies.manage') then raise exception 'Sem permissão para responder exigência'; end if;
 select * into v_e from public.process_exigencies where id=p_exigency_id
 and organization_id=public.current_org_id() for update;
 if not found then raise exception 'Exigência não encontrada'; end if;
 if v_e.status='accepted' or v_e.status='cancelled' then raise exception 'Exigência encerrada'; end if;
 if not exists(select 1 from public.documents where id=p_document_id
 and process_id=v_e.process_id and organization_id=v_e.organization_id) then
  raise exception 'Comprovante da resposta deve estar vinculado ao processo';
 end if;
 insert into public.process_exigency_evidence
 (organization_id,process_id,exigency_id,document_id,evidence_kind,uploaded_by)
 values(v_e.organization_id,v_e.process_id,v_e.id,p_document_id,'response',auth.uid())
 on conflict (exigency_id,document_id,evidence_kind) do nothing;
 update public.process_exigencies set status='responded',response_protocol=nullif(trim(p_response_protocol),''),
 response_summary=p_summary,responded_at=now(),updated_at=now()
 where id=v_e.id returning * into v_e;
 return to_jsonb(v_e);
end $$;

create or replace function public.atlas_v71_close_exigency(
 p_exigency_id uuid,p_accepted boolean,p_justification text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_e public.process_exigencies%rowtype;
begin
 if not public.has_atlas_permission('exigencies.manage') then raise exception 'Sem permissão para encerrar exigência'; end if;
 if nullif(trim(coalesce(p_justification,'')),'') is null then raise exception 'Justificativa obrigatória'; end if;
 select * into v_e from public.process_exigencies where id=p_exigency_id
 and organization_id=public.current_org_id() for update;
 if not found then raise exception 'Exigência não encontrada'; end if;
 if p_accepted then
  if v_e.responded_at is null or not exists
   (select 1 from public.process_exigency_evidence where exigency_id=v_e.id and evidence_kind='response') then
   raise exception 'É necessário registrar resposta e comprovante antes do aceite';
  end if;
  update public.process_exigencies set status='accepted',accepted_at=now(),accepted_by=auth.uid(),
  acceptance_notes=p_justification,updated_at=now() where id=v_e.id returning * into v_e;
 else
  update public.process_exigencies set status='reopened',accepted_at=null,accepted_by=null,
  acceptance_notes=p_justification,updated_at=now() where id=v_e.id returning * into v_e;
 end if;
 return to_jsonb(v_e);
end $$;

-- Aplicar permissões de execução; nenhuma função atual de produção é substituída.
grant execute on function public.atlas_v71_init_document_checklist(uuid) to authenticated;
grant execute on function public.atlas_v71_add_document_version(uuid,uuid) to authenticated;
grant execute on function public.atlas_v71_review_document(uuid,text,text) to authenticated;
grant execute on function public.atlas_v71_create_exigency(uuid,text,text,text,text,date,date,uuid,uuid) to authenticated;
grant execute on function public.atlas_v71_mark_exigency_responded(uuid,uuid,text,text) to authenticated;
grant execute on function public.atlas_v71_close_exigency(uuid,boolean,text) to authenticated;
