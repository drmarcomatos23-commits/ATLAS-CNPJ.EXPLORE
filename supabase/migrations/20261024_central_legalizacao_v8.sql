-- ATLAS Legalização V8 — Central de Legalização
-- Funções inspiradas nas ferramentas de mercado (Acessórias, Gestta, Projuris Empresas,
-- Econsulte, Siga/Ambipar, Jettax, Dootax), implementadas apenas com recursos que o
-- ATLAS já possui (Supabase + pg_cron). Nenhuma API paga.
--
-- 1. Checklist de tarefas por processo (data meta x data legal, status "impedida" com justificativa)
-- 2. Modelos de checklist por tipo de serviço
-- 3. Exigências / condicionantes formais vinculadas a processo e licença
-- 4. Protocolos com escrita liberada para Admin/Operação
-- 5. Licenças ampliadas para certidões e certificados digitais
-- 6. Alertas escalonados diários no sino (120/90/60/30/15/7/3/1/0 dias)

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- 1. TAREFAS / CHECKLIST
-- ------------------------------------------------------------------
create table if not exists public.process_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 240),
  description text,
  phase text,
  position integer not null default 0,
  status text not null default 'aberta'
    check (status in ('aberta','concluida','impedida','desconsiderada')),
  blocked_reason text,
  responsible_party text not null default 'escritorio'
    check (responsible_party in ('escritorio','cliente','orgao')),
  assignee_id uuid references public.profiles(id) on delete set null,
  target_date date,
  legal_date date,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  client_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_tasks_blocked_reason_required
    check (status <> 'impedida' or length(trim(coalesce(blocked_reason,''))) >= 3)
);
create index if not exists idx_process_tasks_process on public.process_tasks(process_id, position);
create index if not exists idx_process_tasks_open_dates on public.process_tasks(organization_id, status, target_date);

-- ------------------------------------------------------------------
-- 2. MODELOS DE CHECKLIST
-- ------------------------------------------------------------------
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  service_type text,
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- ------------------------------------------------------------------
-- 3. EXIGÊNCIAS / CONDICIONANTES
-- ------------------------------------------------------------------
create table if not exists public.process_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  process_id uuid references public.processes(id) on delete cascade,
  license_id uuid references public.licenses(id) on delete set null,
  kind text not null default 'exigencia' check (kind in ('exigencia','condicionante')),
  agency text,
  description text not null check (length(trim(description)) >= 3),
  received_at date,
  due_date date,
  status text not null default 'aberta'
    check (status in ('aberta','em_atendimento','cumprida','cancelada')),
  resolution text,
  resolved_at timestamptz,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_process_requirements_open on public.process_requirements(organization_id, status, due_date);
create index if not exists idx_process_requirements_process on public.process_requirements(process_id);

-- ------------------------------------------------------------------
-- 4/5. PROTOCOLOS E LICENÇAS AMPLIADOS
-- ------------------------------------------------------------------
alter table public.protocols add column if not exists notes text;
alter table public.protocols add column if not exists created_at timestamptz not null default now();
create index if not exists idx_protocols_process on public.protocols(process_id);

alter table public.licenses add column if not exists category text not null default 'licenca';
alter table public.licenses add column if not exists responsible_id uuid references public.profiles(id) on delete set null;
alter table public.licenses add column if not exists notes text;
alter table public.licenses add column if not exists official_url text;
alter table public.licenses add column if not exists last_checked_at date;
do $$ begin
  alter table public.licenses add constraint licenses_category_check
    check (category in ('licenca','alvara','certidao','certificado_digital','registro','outro'));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------------
create or replace function atlas_private.touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_process_tasks_touch on public.process_tasks;
create trigger trg_process_tasks_touch before update on public.process_tasks
for each row execute function atlas_private.touch_updated_at();
drop trigger if exists trg_process_requirements_touch on public.process_requirements;
create trigger trg_process_requirements_touch before update on public.process_requirements
for each row execute function atlas_private.touch_updated_at();
drop trigger if exists trg_task_templates_touch on public.task_templates;
create trigger trg_task_templates_touch before update on public.task_templates
for each row execute function atlas_private.touch_updated_at();

-- Conclusão registra data e autor; reabertura limpa.
create or replace function atlas_private.process_task_completion()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
  elsif new.status <> 'concluida' then
    new.completed_at := null; new.completed_by := null;
  end if;
  if new.status <> 'impedida' then new.blocked_reason := null; end if;
  return new;
end $$;
drop trigger if exists trg_process_task_completion on public.process_tasks;
create trigger trg_process_task_completion before insert or update on public.process_tasks
for each row execute function atlas_private.process_task_completion();

create or replace function atlas_private.process_requirement_resolution()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.status in ('cumprida','cancelada') then new.resolved_at := coalesce(new.resolved_at, now());
  else new.resolved_at := null; end if;
  return new;
end $$;
drop trigger if exists trg_process_requirement_resolution on public.process_requirements;
create trigger trg_process_requirement_resolution before insert or update on public.process_requirements
for each row execute function atlas_private.process_requirement_resolution();

-- Histórico (Empresa 360° / auditoria)
drop trigger if exists atlas_audit_process_tasks on public.process_tasks;
create trigger atlas_audit_process_tasks after insert or update or delete on public.process_tasks
for each row execute function atlas_private.capture_audit_log();
drop trigger if exists atlas_audit_process_requirements on public.process_requirements;
create trigger atlas_audit_process_requirements after insert or update or delete on public.process_requirements
for each row execute function atlas_private.capture_audit_log();
drop trigger if exists atlas_audit_protocols on public.protocols;
create trigger atlas_audit_protocols after insert or update or delete on public.protocols
for each row execute function atlas_private.capture_audit_log();

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
alter table public.process_tasks enable row level security;
alter table public.process_requirements enable row level security;
alter table public.task_templates enable row level security;
alter table public.protocols enable row level security;

revoke all on table public.process_tasks, public.process_requirements, public.task_templates from anon;
grant select, insert, update, delete on table public.process_tasks, public.process_requirements, public.task_templates to authenticated;

-- Tarefas: equipe interna vê tudo da organização; cliente vê apenas as visíveis da sua empresa.
drop policy if exists atlas_process_tasks_select on public.process_tasks;
create policy atlas_process_tasks_select on public.process_tasks for select to authenticated
using (
  organization_id = public.current_org_id()
  and exists (select 1 from public.processes p where p.id = process_tasks.process_id and p.deleted_at is null
    and (public.current_atlas_role() in ('admin','operacao','financeiro','auditoria')
      or (public.current_atlas_role() = 'cliente' and process_tasks.client_visible
          and p.client_id::text = public.current_client_external_id())))
);
drop policy if exists atlas_process_tasks_write on public.process_tasks;
create policy atlas_process_tasks_write on public.process_tasks for all to authenticated
using (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao'))
with check (
  organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao')
  and exists (select 1 from public.processes p where p.id = process_tasks.process_id and p.organization_id = public.current_org_id())
);

drop policy if exists atlas_process_requirements_select on public.process_requirements;
create policy atlas_process_requirements_select on public.process_requirements for select to authenticated
using (
  organization_id = public.current_org_id()
  and (public.current_atlas_role() in ('admin','operacao','financeiro','auditoria')
    or (public.current_atlas_role() = 'cliente' and client_id::text = public.current_client_external_id()))
);
drop policy if exists atlas_process_requirements_write on public.process_requirements;
create policy atlas_process_requirements_write on public.process_requirements for all to authenticated
using (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao'))
with check (
  organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao')
  and exists (select 1 from public.clients c where c.id = process_requirements.client_id and c.organization_id = public.current_org_id())
);

drop policy if exists atlas_task_templates_select on public.task_templates;
create policy atlas_task_templates_select on public.task_templates for select to authenticated
using (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao','auditoria'));
drop policy if exists atlas_task_templates_write on public.task_templates;
create policy atlas_task_templates_write on public.task_templates for all to authenticated
using (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao'))
with check (organization_id = public.current_org_id() and public.current_atlas_role() in ('admin','operacao'));

-- Protocolos: a leitura já existia; agora Admin/Operação podem registrar e atualizar.
revoke truncate, references, trigger on table public.protocols from authenticated;
drop policy if exists atlas_protocols_write on public.protocols;
create policy atlas_protocols_write on public.protocols for all to authenticated
using (
  public.current_atlas_role() in ('admin','operacao')
  and exists (select 1 from public.processes p where p.id = protocols.process_id and p.organization_id = public.current_org_id())
)
with check (
  public.current_atlas_role() in ('admin','operacao')
  and exists (select 1 from public.processes p where p.id = protocols.process_id
    and p.organization_id = public.current_org_id() and p.deleted_at is null)
);

-- ------------------------------------------------------------------
-- MODELOS PADRÃO (por organização)
-- offset = dias após o início do processo para a data meta
-- ------------------------------------------------------------------
insert into public.task_templates (organization_id, name, service_type, items)
select o.id, t.name, t.service_type, t.items::jsonb
from public.organizations o
cross join (values
 ('Abertura de empresa (LTDA / SLU)','abertura','[
  {"title":"Briefing com o cliente (atividade, sócios, capital, endereço)","phase":"Briefing","party":"escritorio","offset":1},
  {"title":"Receber documentos pessoais dos sócios e comprovante de endereço","phase":"Briefing","party":"cliente","offset":3},
  {"title":"Consulta de viabilidade de nome e endereço","phase":"Viabilidade","party":"escritorio","offset":4},
  {"title":"Aguardar deferimento da viabilidade","phase":"Viabilidade","party":"orgao","offset":7},
  {"title":"Preencher DBE / coleta na Receita Federal","phase":"DBE / Receita","party":"escritorio","offset":8},
  {"title":"Redigir contrato social e colher assinaturas","phase":"Registro","party":"escritorio","offset":10},
  {"title":"Protocolar na Junta Comercial e pagar DARE","phase":"Registro","party":"escritorio","offset":11},
  {"title":"Obter NIRE e CNPJ","phase":"Registro","party":"orgao","offset":15},
  {"title":"Inscrição municipal / estadual","phase":"Inscrições","party":"escritorio","offset":18},
  {"title":"Alvará de funcionamento e demais licenças","phase":"Licenciamento","party":"escritorio","offset":25},
  {"title":"Entregar cartilha e documentos finais ao cliente","phase":"Conclusão","party":"escritorio","offset":28}]'),
 ('Alteração contratual','alteracao','[
  {"title":"Levantar alterações pretendidas (sócios, endereço, CNAE, capital)","phase":"Briefing","party":"escritorio","offset":1},
  {"title":"Receber documentos e informações do cliente","phase":"Briefing","party":"cliente","offset":3},
  {"title":"Viabilidade (se houver mudança de endereço ou atividade)","phase":"Viabilidade","party":"escritorio","offset":4},
  {"title":"DBE de alteração na Receita Federal","phase":"DBE / Receita","party":"escritorio","offset":6},
  {"title":"Minuta da alteração / consolidação e assinaturas","phase":"Registro","party":"escritorio","offset":8},
  {"title":"Protocolo na Junta Comercial","phase":"Registro","party":"escritorio","offset":9},
  {"title":"Atualizar inscrições e licenças afetadas","phase":"Inscrições","party":"escritorio","offset":15},
  {"title":"Entregar documentos registrados ao cliente","phase":"Conclusão","party":"escritorio","offset":18}]'),
 ('Baixa de empresa','baixa','[
  {"title":"Verificar débitos e emitir certidões (Federal, FGTS, Estadual, Municipal, Trabalhista)","phase":"Briefing","party":"escritorio","offset":2},
  {"title":"Regularizar pendências fiscais identificadas","phase":"Briefing","party":"cliente","offset":10},
  {"title":"Distrato social e assinaturas","phase":"Registro","party":"escritorio","offset":12},
  {"title":"Protocolo de extinção na Junta Comercial / Redesim","phase":"Registro","party":"escritorio","offset":14},
  {"title":"Baixa das inscrições estadual e municipal","phase":"Inscrições","party":"escritorio","offset":20},
  {"title":"Cancelar licenças, alvarás e certificado digital","phase":"Licenciamento","party":"escritorio","offset":25},
  {"title":"Entregar comprovantes de baixa ao cliente","phase":"Conclusão","party":"escritorio","offset":28}]'),
 ('Renovação de licença / alvará','renovacao','[
  {"title":"Conferir requisitos e documentos exigidos pelo órgão","phase":"Briefing","party":"escritorio","offset":1},
  {"title":"Receber documentos atualizados do cliente","phase":"Briefing","party":"cliente","offset":5},
  {"title":"Emitir guia e pagar taxa","phase":"Licenciamento","party":"escritorio","offset":7},
  {"title":"Protocolar pedido de renovação","phase":"Licenciamento","party":"escritorio","offset":8},
  {"title":"Acompanhar vistoria / exigências do órgão","phase":"Licenciamento","party":"orgao","offset":20},
  {"title":"Atualizar vencimento no ATLAS e anexar a nova licença","phase":"Conclusão","party":"escritorio","offset":25}]'),
 ('Holding patrimonial','holding','[
  {"title":"Diagnóstico patrimonial e sucessório","phase":"Briefing","party":"escritorio","offset":3},
  {"title":"Receber matrículas, documentos dos bens e dos sócios","phase":"Briefing","party":"cliente","offset":7},
  {"title":"Definir tipo societário, capital e cláusulas (doação, usufruto, inalienabilidade)","phase":"Briefing","party":"escritorio","offset":10},
  {"title":"Viabilidade e DBE","phase":"Viabilidade","party":"escritorio","offset":12},
  {"title":"Contrato social e registro na Junta Comercial","phase":"Registro","party":"escritorio","offset":18},
  {"title":"Integralização dos imóveis (ITBI / imunidade) e registro em cartório","phase":"Inscrições","party":"escritorio","offset":35},
  {"title":"Instrumentos de doação de quotas e protocolo do ITCMD","phase":"Inscrições","party":"escritorio","offset":45},
  {"title":"Entregar dossiê final ao cliente","phase":"Conclusão","party":"escritorio","offset":50}]')
) as t(name, service_type, items)
on conflict (organization_id, name) do nothing;

-- ------------------------------------------------------------------
-- 6. ALERTAS DIÁRIOS NO SINO
-- ------------------------------------------------------------------
create or replace function atlas_private.generate_legalizacao_alerts()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  created integer := 0;
  n integer;
begin
  -- Licenças, alvarás e certidões: avisos em 120/90/60/30/15/7/3/1/0 dias e uma vez após vencer.
  with due as (
    select l.id, l.name, l.expires_at, l.client_id, c.organization_id, c.legal_name,
           (l.expires_at - today) as days_left
    from public.licenses l
    join public.clients c on c.id = l.client_id and c.deleted_at is null
    where l.expires_at is not null
      and coalesce(l.status,'active') not in ('not_applicable','cancelled')
  ), hits as (
    select d.*, case when d.days_left < 0 then 'expired' else d.days_left::text end as mark
    from due d
    where d.days_left in (120,90,60,30,15,7,3,1,0) or d.days_left = -1
  ), recipients as (
    select h.*, a.user_id
    from hits h
    join public.atlas_hub_system_access a on a.organization_id = h.organization_id
      and a.system_key = 'legalizacao' and a.allowed and a.system_role in ('admin','operacao')
    join public.profiles p on p.id = a.user_id and p.active
  ), ins as (
    insert into public.atlas_notifications (organization_id, recipient_profile_id, event_type, title, body, client_id, metadata)
    select r.organization_id, r.user_id, 'license_expiry',
      case when r.days_left < 0 then 'Vencido: ' || r.name
           when r.days_left = 0 then 'Vence hoje: ' || r.name
           else r.name || ' vence em ' || r.days_left || ' dia(s)' end,
      r.legal_name || ' · vencimento ' || to_char(r.expires_at,'DD/MM/YYYY'),
      r.client_id,
      jsonb_build_object('dedupe_key','lic:'||r.id||':'||r.expires_at||':'||r.mark,'license_id',r.id,'days_left',r.days_left)
    from recipients r
    where not exists (
      select 1 from public.atlas_notifications x
      where x.recipient_profile_id = r.user_id
        and x.metadata ->> 'dedupe_key' = 'lic:'||r.id||':'||r.expires_at||':'||r.mark)
    returning 1
  ) select count(*) into n from ins;
  created := created + n;

  -- Tarefas do escritório com data meta hoje ou atrasada (um aviso por dia ao responsável).
  with t as (
    select k.id, k.title, k.target_date, k.legal_date, k.process_id, k.organization_id, k.assignee_id,
           pr.public_code, pr.client_id, pr.owner_id
    from public.process_tasks k
    join public.processes pr on pr.id = k.process_id and pr.deleted_at is null
      and coalesce(pr.status,'') not in ('completed','cancelled')
    where k.status = 'aberta' and k.target_date is not null and k.target_date <= today
  ), ins as (
    insert into public.atlas_notifications (organization_id, recipient_profile_id, event_type, title, body, process_id, client_id, metadata)
    select t.organization_id, coalesce(t.assignee_id, t.owner_id), 'task_due',
      case when t.target_date < today then 'Tarefa atrasada: ' else 'Tarefa para hoje: ' end || t.title,
      coalesce(t.public_code,'Processo') || ' · data meta ' || to_char(t.target_date,'DD/MM/YYYY')
        || coalesce(' · data legal ' || to_char(t.legal_date,'DD/MM/YYYY'), ''),
      t.process_id, t.client_id,
      jsonb_build_object('dedupe_key','task:'||t.id||':'||today,'task_id',t.id)
    from t
    where coalesce(t.assignee_id, t.owner_id) is not null
      and not exists (select 1 from public.atlas_notifications x
        where x.recipient_profile_id = coalesce(t.assignee_id, t.owner_id)
          and x.metadata ->> 'dedupe_key' = 'task:'||t.id||':'||today)
    returning 1
  ) select count(*) into n from ins;
  created := created + n;

  -- Exigências abertas com prazo em 3 dias, hoje ou vencido (um aviso por marco).
  with q as (
    select r.id, r.description, r.agency, r.due_date, r.organization_id, r.client_id, r.process_id,
           coalesce(r.assignee_id, pr.owner_id) as who, (r.due_date - today) as days_left
    from public.process_requirements r
    left join public.processes pr on pr.id = r.process_id
    where r.status in ('aberta','em_atendimento') and r.due_date is not null and r.due_date - today <= 3
  ), ins as (
    insert into public.atlas_notifications (organization_id, recipient_profile_id, event_type, title, body, process_id, client_id, metadata)
    select q.organization_id, q.who, 'requirement_due',
      case when q.days_left < 0 then 'Exigência vencida' when q.days_left = 0 then 'Exigência vence hoje' else 'Exigência vence em '||q.days_left||' dia(s)' end,
      coalesce(q.agency || ' · ', '') || left(q.description, 140),
      q.process_id, q.client_id,
      jsonb_build_object('dedupe_key','req:'||q.id||':'||case when q.days_left<0 then 'late' else q.days_left::text end,'requirement_id',q.id)
    from q
    where q.who is not null
      and not exists (select 1 from public.atlas_notifications x
        where x.recipient_profile_id = q.who
          and x.metadata ->> 'dedupe_key' = 'req:'||q.id||':'||case when q.days_left<0 then 'late' else q.days_left::text end)
    returning 1
  ) select count(*) into n from ins;
  created := created + n;

  return created;
end $$;

revoke all on function atlas_private.generate_legalizacao_alerts() from public, anon, authenticated;

create index if not exists idx_atlas_notifications_dedupe
  on public.atlas_notifications ((metadata ->> 'dedupe_key'), recipient_profile_id);

-- Todo dia às 07:40 (Brasília) = 10:40 UTC. (Alterado para 08:40 na migração 20261025_resumo_diario_v8_4.)
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'atlas-legalizacao-alertas-diario';
  perform cron.schedule('atlas-legalizacao-alertas-diario', '40 10 * * *',
    'select atlas_private.generate_legalizacao_alerts();');
end $$;
