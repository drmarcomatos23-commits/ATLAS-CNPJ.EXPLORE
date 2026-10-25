-- ATLAS Legalização V8.1 — Documentos por serviço (fluxo WhatsApp)
-- Lista de documentos exigidos por tipo de serviço, com marcação de recebido e vínculo
-- ao arquivo do dossiê. Sem custo externo.

alter table public.task_templates add column if not exists documents jsonb not null default '[]'::jsonb;

create table if not exists public.process_doc_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 200),
  category text not null default 'Documento pessoal',
  required boolean not null default true,
  status text not null default 'pendente' check (status in ('pendente','recebido','dispensado')),
  document_id uuid references public.documents(id) on delete set null,
  received_at timestamptz,
  notes text,
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_process_doc_items_process on public.process_doc_items(process_id, position);

alter table public.process_doc_items enable row level security;
grant select, insert, update, delete on table public.process_doc_items to authenticated;

create policy atlas_process_doc_items_select on public.process_doc_items for select to authenticated
using (organization_id = public.current_org_id()
  and public.current_atlas_role() in ('admin','operacao','financeiro','auditoria')
  and exists (select 1 from public.processes p where p.id = process_doc_items.process_id and p.deleted_at is null));
create policy atlas_process_doc_items_write on public.process_doc_items for all to authenticated
using (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao'))
with check (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao')
  and exists (select 1 from public.processes p where p.id = process_doc_items.process_id and p.organization_id = public.current_org_id()));

create or replace function atlas_private.process_doc_item_received()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.status = 'recebido' then new.received_at := coalesce(new.received_at, now());
  else new.received_at := null; end if;
  return new;
end $$;

create or replace trigger trg_process_doc_items_touch before update on public.process_doc_items
for each row execute function atlas_private.touch_updated_at();
create or replace trigger trg_process_doc_item_received before insert or update on public.process_doc_items
for each row execute function atlas_private.process_doc_item_received();
create or replace trigger atlas_audit_process_doc_items after insert or update or delete on public.process_doc_items
for each row execute function atlas_private.capture_audit_log();

-- Listas padrão de documentos por modelo
update public.task_templates set documents = '[
 {"name":"RG ou CNH dos sócios","category":"Documento pessoal"},
 {"name":"CPF dos sócios","category":"Documento pessoal"},
 {"name":"Comprovante de residência dos sócios","category":"Comprovante"},
 {"name":"Certidão de casamento dos sócios casados","category":"Documento pessoal"},
 {"name":"IPTU do imóvel da sede","category":"Comprovante"},
 {"name":"Contrato de locação ou escritura da sede","category":"Contrato"},
 {"name":"Descrição das atividades da empresa","category":"Societário"}
]'::jsonb where service_type = 'abertura' and documents = '[]'::jsonb;

update public.task_templates set documents = '[
 {"name":"Contrato social e última alteração","category":"Societário"},
 {"name":"RG ou CNH dos sócios que entram ou saem","category":"Documento pessoal"},
 {"name":"Comprovante de residência dos novos sócios","category":"Comprovante"},
 {"name":"IPTU do novo endereço","category":"Comprovante"},
 {"name":"Contrato de locação do novo endereço","category":"Contrato"}
]'::jsonb where service_type = 'alteracao' and documents = '[]'::jsonb;

update public.task_templates set documents = '[
 {"name":"Contrato social consolidado","category":"Societário"},
 {"name":"Certidões negativas da empresa","category":"Fiscal"},
 {"name":"Balanço de encerramento (contador)","category":"Fiscal"},
 {"name":"RG ou CNH dos sócios","category":"Documento pessoal"}
]'::jsonb where service_type = 'baixa' and documents = '[]'::jsonb;

update public.task_templates set documents = '[
 {"name":"Licença ou alvará atual","category":"Licença"},
 {"name":"IPTU ou habite-se do imóvel","category":"Comprovante"},
 {"name":"AVCB vigente","category":"Licença"},
 {"name":"Contrato social atual","category":"Societário"},
 {"name":"Comprovante de pagamento da taxa","category":"Comprovante"}
]'::jsonb where service_type = 'renovacao' and documents = '[]'::jsonb;

update public.task_templates set documents = '[
 {"name":"RG ou CNH dos sócios e herdeiros","category":"Documento pessoal"},
 {"name":"CPF dos sócios e herdeiros","category":"Documento pessoal"},
 {"name":"Certidão de casamento e pacto antenupcial","category":"Documento pessoal"},
 {"name":"Comprovante de residência dos sócios","category":"Comprovante"},
 {"name":"Matrículas atualizadas dos imóveis","category":"Contrato"},
 {"name":"IPTU ou valor venal dos imóveis","category":"Comprovante"},
 {"name":"Última declaração de IR dos sócios","category":"Fiscal"},
 {"name":"Documentos de veículos e participações societárias","category":"Societário"}
]'::jsonb where service_type = 'holding' and documents = '[]'::jsonb;
