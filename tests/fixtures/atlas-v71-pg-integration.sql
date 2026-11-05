-- DB homologation against disposable PostgreSQL (GitHub Actions).
-- Errors are deliberate when validating negative paths. Nothing here addresses production.
\set ON_ERROR_STOP on
set role authenticated;
select set_config('atlas_test.org_id','11111111-1111-4111-8111-111111111111',false);
select set_config('atlas_test.user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('atlas_test.role','admin',false);

-- Process activation does not modify public production tenants.
select public.atlas_v71_activate_process('99999999-9999-4999-8999-999999999999'::uuid);
do $$ begin
 if not exists(select 1 from public.process_operations where process_id='99999999-9999-4999-8999-999999999999') then
  raise exception 'Process not activated';
 end if;
end $$;

-- A conditional or optional document does not block advancement. Required docs do.
insert into public.document_requirement_templates
(organization_id,service_type,title,required_rule,category,created_by)
values ('11111111-1111-4111-8111-111111111111','abertura','Documento obrigatório no teste','required','Societário','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select public.atlas_v71_init_document_checklist('99999999-9999-4999-8999-999999999999'::uuid);
do $$ begin
 if (select count(*) from public.process_document_requirements
     where process_id='99999999-9999-4999-8999-999999999999') < 4 then
  raise exception 'Initial checklist not created';
 end if;
end $$;

do $$ begin
 perform public.atlas_v71_advance_stage('99999999-9999-4999-8999-999999999999'::uuid);
 raise exception 'BUG: advanced without required document';
exception when others then
 if SQLERRM='BUG: advanced without required document' or SQLERRM not like '%documentos obrigatórios%' then raise; end if;
end $$;

insert into public.documents(id,organization_id,process_id,client_id,name,storage_key)
values('12345678-1234-4234-8234-123456789abc',
'11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',
'cccccccc-cccc-4ccc-8ccc-cccccccccccc','documento.pdf','ci-fake/test.pdf');

select public.atlas_v71_add_document_version(
 (select id from public.process_document_requirements where title='Documento obrigatório no teste'),
 '12345678-1234-4234-8234-123456789abc'
);

-- Upload alone MUST NOT count as reviewed.
do $$ begin
 if not exists(select 1 from public.process_document_requirements
     where title='Documento obrigatório no teste' and status='submitted') then
  raise exception 'Uploaded document was silently approved';
 end if;
end $$;
select public.atlas_v71_review_document(
 (select id from public.process_document_requirements where title='Documento obrigatório no teste'),
 'approved','Identidade conferida em ambiente sintético');

select public.atlas_v71_create_exigency(
 '99999999-9999-4999-8999-999999999999',
 'Junta Comercial','Exigência de teste','Regularizar documento', 'TEST-2026-001',
 current_date, current_date+3,null,null);

do $$ begin
 perform public.atlas_v71_advance_stage('99999999-9999-4999-8999-999999999999'::uuid);
 raise exception 'BUG: advanced before formal exigency acceptance';
exception when others then
 if SQLERRM='BUG: advanced before formal exigency acceptance' or SQLERRM not like '%exigências formais%' then raise; end if;
end $$;
select public.atlas_v71_mark_exigency_responded(
 (select id from public.process_exigencies where title='Exigência de teste'),
 '12345678-1234-4234-8234-123456789abc',
 'RESPOSTA-01','Resposta de teste entregue');
do $$ begin
 if not exists(select 1 from public.process_exigencies where status='responded') then
  raise exception 'Formal response did not preserve responded state';
 end if;
end $$;

select public.atlas_v71_close_exigency(
 (select id from public.process_exigencies where title='Exigência de teste'),
 true, 'Deferimento confirmado em ambiente de teste');

select public.atlas_v71_advance_stage('99999999-9999-4999-8999-999999999999'::uuid);
do $$ begin
 if (select current_stage_id from public.processes where id='99999999-9999-4999-8999-999999999999')
    <> 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid then
  raise exception 'Stage did not advance after acceptance';
 end if;
 if (select count(*) from public.process_document_events where process_id='99999999-9999-4999-8999-999999999999') < 5 then
  raise exception 'Audit events missing';
 end if;
end $$;

-- An authenticated legacy direct UPDATE cannot bypass the guarded workflow.
do $$ begin
 update public.processes set current_stage_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' where id='99999999-9999-4999-8999-999999999999';
 raise exception 'BUG: direct stage update succeeded';
exception when others then
 if SQLERRM='BUG: direct stage update succeeded' or SQLERRM not like '%avanço%' and SQLERRM not like '%avançar%' then raise; end if;
end $$;

-- Cross-tenant RLS must not expose documents/checklists/exigencies.
select set_config('atlas_test.org_id','22222222-2222-4222-8222-222222222222',false);
select set_config('atlas_test.user_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select set_config('atlas_test.role','operacao',false);
do $$ begin
 if exists(select 1 from public.process_document_requirements where process_id='99999999-9999-4999-8999-999999999999')
 or exists(select 1 from public.process_exigencies where process_id='99999999-9999-4999-8999-999999999999')
 or exists(select 1 from public.process_document_events where process_id='99999999-9999-4999-8999-999999999999') then
  raise exception 'RLS leaked another organization';
 end if;
end $$;
select 'ATLAS_V71_SQL_INTEGRATION_OK' as result;
