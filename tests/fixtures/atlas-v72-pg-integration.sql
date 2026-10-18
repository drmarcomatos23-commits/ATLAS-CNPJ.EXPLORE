-- ATLAS V7.2: único banco PostgreSQL descartável, exclusivamente dados sintéticos.
\set ON_ERROR_STOP on
set role authenticated;
select set_config('atlas_test.org_id','11111111-1111-4111-8111-111111111111',false);
select set_config('atlas_test.user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('atlas_test.role','admin',false);

-- O segundo processo sintético ainda está na primeira etapa.
select public.atlas_v71_activate_process('88888888-8888-4888-8888-888888888888'::uuid);
select public.atlas_v72_init_document_checklist('88888888-8888-4888-8888-888888888888'::uuid);
select public.atlas_v72_init_document_checklist('88888888-8888-4888-8888-888888888888'::uuid);
do $$ begin
 if (select count(*) from public.process_document_requirements where process_id='88888888-8888-4888-8888-888888888888') < 5 then
  raise exception 'V7.2 template was not materialized'; end if;
 if exists (select template_id from public.process_document_requirements where process_id='88888888-8888-4888-8888-888888888888'
  and template_id is not null group by template_id having count(*)>1) then
  raise exception 'Checklist retry duplicated templates'; end if;
 if (select count(*) from public.document_requirement_templates where service_type='encerramento'
  and organization_id=public.current_org_id()) < 5 then raise exception 'Missing ending templates'; end if;
end $$;

-- Toda alteração exige organização, origem e ator; eventos serão auditados no servidor.
select public.atlas_v72_add_manual_requirement('88888888-8888-4888-8888-888888888888'::uuid,
 'Documento obrigatório de homologação','required','33333333-3333-4333-8333-333333333333'::uuid,
 'Verificar o instrumento perante o órgão');
select public.atlas_v72_add_manual_requirement('88888888-8888-4888-8888-888888888888'::uuid,
 'Documento obrigatório de homologação','required','33333333-3333-4333-8333-333333333333'::uuid,
 'Verificar o instrumento perante o órgão');
do $$ begin
 if (select count(*) from public.process_document_requirements where title='Documento obrigatório de homologação')<>1 then
  raise exception 'Manual-key retry duplicated requirement'; end if;
 if not exists (select 1 from public.process_document_requirements
  where title='Documento obrigatório de homologação' and instructions='Verificar o instrumento perante o órgão') then
  raise exception 'Manual instructions were not linked to requirement'; end if;
end $$;

select public.atlas_v72_update_requirement(
 (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
 jsonb_build_object('status','requested','pending_with','cliente','assigned_to','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','due_on',current_date+1,'notes','Aguardando cliente'));

-- Comprovação de arquivo em outro processo deve ser rejeitada.
do $$ begin
 begin
  perform public.atlas_v71_add_document_version(
   (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
   '12345678-1234-4234-8234-123456789abc'::uuid);
  raise exception 'BUG: cross-process file accepted';
 exception when others then
  if SQLERRM='BUG: cross-process file accepted' or SQLERRM not like '%pertencer ao processo%' then raise; end if;
 end;
end $$;

insert into public.documents(id,organization_id,process_id,client_id,name,storage_key)
 values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',
 '88888888-8888-4888-8888-888888888888','cccccccc-cccc-4ccc-8ccc-cccccccccccc','comprovante-sintetico.pdf','test/second.pdf');
select public.atlas_v71_add_document_version(
 (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
 '44444444-4444-4444-8444-444444444444'::uuid);
do $$ begin
 if not exists(select 1 from public.process_document_requirements
  where title='Documento obrigatório de homologação' and status='received' and received_at is not null) then
  raise exception 'Received evidence was not recorded'; end if;
end $$;

select public.atlas_v72_update_requirement(
 (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
 '{"status":"returned","pending_with":"cliente","reason":"Arquivo ilegível"}'::jsonb);
select public.atlas_v72_update_requirement(
 (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
 '{"status":"approved","reason":"Conferência concluída"}'::jsonb);
do $$ begin
 if not exists(select 1 from public.process_document_requirements
  where title='Documento obrigatório de homologação' and status='approved' and reviewed_by is not null) then
  raise exception 'Evidence approval was not audited'; end if;
end $$;

-- Leitura granular é permitida para financeiro/auditoria, mas jamais mutação;
-- cliente não recebe leitura nem sequer na própria organização.
select set_config('atlas_test.user_id','66666666-6666-4666-8666-666666666666',false);
select set_config('atlas_test.role','financeiro',false);
do $$ begin
 if not exists(select 1 from public.process_document_requirements
  where title='Documento obrigatório de homologação') then raise exception 'Finance read-only missing'; end if;
 begin
  perform public.atlas_v72_update_requirement(
   (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
   '{"status":"waived","reason":"Teste proibido"}'::jsonb);
  raise exception 'BUG: finance approved documentary update';
 exception when others then
  if SQLERRM='BUG: finance approved documentary update' or SQLERRM not like '%Sem permissão%' then raise; end if;
 end;
end $$;
select set_config('atlas_test.user_id','77777777-7777-4777-8777-777777777777',false);
select set_config('atlas_test.role','auditoria',false);
do $$ begin
 if not exists(select 1 from public.process_document_events
  where process_id='88888888-8888-4888-8888-888888888888') then raise exception 'Audit read-only missing'; end if;
end $$;
select set_config('atlas_test.user_id','abababab-abab-4bab-8bab-abababababab',false);
select set_config('atlas_test.role','cliente',false);
do $$ begin
 if exists(select 1 from public.process_document_requirements
  where process_id='88888888-8888-4888-8888-888888888888') then raise exception 'Client checklist read exposed'; end if;
end $$;
select set_config('atlas_test.user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('atlas_test.role','admin',false);

-- Não é possível dispensar documento sem motivo.
do $$ begin
 begin
  perform public.atlas_v72_update_requirement(
   (select id from public.process_document_requirements where title='Documento obrigatório de homologação'),
   '{"status":"waived","reason":" "}'::jsonb);
  raise exception 'BUG: unreasoned waiver accepted';
 exception when others then
  if SQLERRM='BUG: unreasoned waiver accepted' or SQLERRM not like '%Justificativa%' then raise; end if;
 end;
end $$;

-- Uma nova pendência documental obrigatória, tarefa, custo e exigência coexistem.
select public.atlas_v72_add_manual_requirement('88888888-8888-4888-8888-888888888888'::uuid,
 'Pendência documental aberta','required','55555555-5555-4555-8555-555555555555'::uuid);
select public.atlas_v72_update_requirement(
 (select id from public.process_document_requirements where title='Pendência documental aberta'),
 '{"status":"requested","pending_with":"cliente"}'::jsonb);
insert into public.tasks(organization_id,process_id,stage_id,title,required,created_by)
 values('11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Tarefa obrigatória em aberto',true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.costs(organization_id,process_id,description,payment_status,amount,due_date)
 values('11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888',
  'Taxa de registro em aberto','pending',300.00,current_date+2);
select public.atlas_v71_create_exigency('88888888-8888-4888-8888-888888888888'::uuid,
 'Junta Comercial','Exigência sintética aberta','Resposta pendente','PROTO-V72',current_date,current_date+3,null,null);

-- AVANÇO NÃO BLOQUEIA: nada em documento, tarefa, financeiro ou órgão é encerrado.
select public.atlas_v71_advance_stage('88888888-8888-4888-8888-888888888888'::uuid);
do $$ declare v_snapshot jsonb;
begin
 if (select current_stage_id from public.processes where id='88888888-8888-4888-8888-888888888888')
   <> 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid then raise exception 'Advisory-only stage did not advance'; end if;
 select metadata->'pending_at_transition' into v_snapshot from public.stage_transitions
  where process_id='88888888-8888-4888-8888-888888888888' order by transitioned_at desc limit 1;
 if coalesce((v_snapshot->>'tasks')::int,0)<1 or coalesce((v_snapshot->>'documents')::int,0)<1
  or coalesce((v_snapshot->>'costs')::int,0)<1 or coalesce((v_snapshot->>'exigencies')::int,0)<1 then
  raise exception 'Transition snapshot missed a pending source: %',v_snapshot; end if;
 if not exists(select 1 from public.process_document_requirements where title='Pendência documental aberta' and status='requested')
  or not exists(select 1 from public.tasks where title='Tarefa obrigatória em aberto' and status='pending')
  or not exists(select 1 from public.costs where description='Taxa de registro em aberto' and payment_status='pending')
  or not exists(select 1 from public.process_exigencies where title='Exigência sintética aberta' and status='open') then
  raise exception 'Stage advancement silently resolved a pending source'; end if;
end $$;

-- Alterar serviço arquiva requisitos anteriores mas NÃO apaga versões ou eventos.
select public.atlas_v72_reconcile_checklist('88888888-8888-4888-8888-888888888888'::uuid,'licenciamento');
do $$ begin
 if not exists(select 1 from public.process_document_requirements
  where title='Documento obrigatório de homologação' and archived_at is not null) then
  raise exception 'Previous service requirements were lost instead of archived'; end if;
 if not exists(select 1 from public.process_document_versions
  where document_id='44444444-4444-4444-8444-444444444444') then raise exception 'Archived document version lost'; end if;
 if (select count(*) from public.process_document_events where process_id='88888888-8888-4888-8888-888888888888')<4 then
  raise exception 'Document trail missing'; end if;
end $$;

-- Cross-tenant RLS: outra organização não lê ou altera processos/documentos.
select set_config('atlas_test.org_id','22222222-2222-4222-8222-222222222222',false);
select set_config('atlas_test.user_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select set_config('atlas_test.role','operacao',false);
do $$ begin
 if exists(select 1 from public.process_document_requirements where process_id='88888888-8888-4888-8888-888888888888')
  or exists(select 1 from public.process_document_events where process_id='88888888-8888-4888-8888-888888888888') then
  raise exception 'Cross-tenant checklist data exposed'; end if;
 begin
  perform public.atlas_v72_update_requirement(
   (select id from public.process_document_requirements where process_id='88888888-8888-4888-8888-888888888888' limit 1),
   '{"status":"approved"}'::jsonb);
  raise exception 'BUG: other organization mutated checklist';
 exception when others then
  if SQLERRM='BUG: other organization mutated checklist' then raise; end if;
 end;
end $$;
select 'ATLAS_V72_SQL_INTEGRATION_OK' as result;
