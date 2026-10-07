create table if not exists public.atlas_notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null default 'fee_created',
  title text not null,
  body text not null,
  process_id uuid references public.processes(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  cost_id uuid references public.costs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_profile_id, event_type, cost_id)
);

create index if not exists atlas_notifications_recipient_unread_idx
  on public.atlas_notifications(recipient_profile_id, read_at, created_at desc);
create index if not exists atlas_notifications_org_created_idx
  on public.atlas_notifications(organization_id, created_at desc);
create unique index if not exists atlas_notifications_fee_process_once_idx
  on public.atlas_notifications(recipient_profile_id, event_type, process_id)
  where event_type = 'fee_created' and process_id is not null;

alter table public.atlas_notifications enable row level security;

drop policy if exists atlas_notifications_select_own on public.atlas_notifications;
create policy atlas_notifications_select_own
on public.atlas_notifications
for select
to authenticated
using (
  recipient_profile_id = auth.uid()
  and organization_id = current_org_id()
);

drop policy if exists atlas_notifications_update_own on public.atlas_notifications;
create policy atlas_notifications_update_own
on public.atlas_notifications
for update
to authenticated
using (
  recipient_profile_id = auth.uid()
  and organization_id = current_org_id()
)
with check (
  recipient_profile_id = auth.uid()
  and organization_id = current_org_id()
);

create or replace function public.atlas_notify_finance_fee_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_process public.processes%rowtype;
  v_client public.clients%rowtype;
  v_actor_name text;
  v_due_text text;
  v_body text;
begin
  if coalesce(new.fee_kind, '') <> 'junta_cartorio'
     and coalesce(new.cost_type, '') <> 'registry_fee' then
    return new;
  end if;

  select * into v_process
  from public.processes
  where id = new.process_id;

  if v_process.id is null then
    return new;
  end if;

  if v_process.client_id is not null then
    select * into v_client
    from public.clients
    where id = v_process.client_id;
  end if;

  select full_name into v_actor_name
  from public.profiles
  where id = auth.uid()
    and organization_id = v_process.organization_id
  limit 1;

  v_due_text := case
    when new.due_date is null then 'sem vencimento informado'
    else 'vencimento ' || to_char(new.due_date, 'DD/MM/YYYY')
  end;

  v_body := coalesce(v_client.legal_name, 'Empresa não informada')
    || ' · ' || coalesce(v_process.public_code, v_process.id::text)
    || E'\nTaxa Junta/Cartório: R$ '
    || replace(to_char(coalesce(new.amount,0), 'FM999G999G999G990D00'), '.', ',')
    || ' · ' || v_due_text;

  insert into public.atlas_notifications (
    organization_id,
    recipient_profile_id,
    event_type,
    title,
    body,
    process_id,
    client_id,
    cost_id,
    metadata
  )
  select
    v_process.organization_id,
    fp.id,
    'fee_created',
    'Nova taxa cadastrada',
    v_body,
    v_process.id,
    v_process.client_id,
    new.id,
    jsonb_build_object(
      'amount', new.amount,
      'due_date', new.due_date,
      'payer_name', new.payer_name,
      'payer_type', new.payer_type,
      'payer_document', new.payer_document,
      'company_name', coalesce(v_client.legal_name, v_client.trade_name),
      'process_code', v_process.public_code,
      'actor_profile_id', auth.uid(),
      'actor_name', v_actor_name
    )
  from public.profiles fp
  where fp.organization_id = v_process.organization_id
    and fp.role = 'financeiro'
    and fp.active = true
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.atlas_notify_finance_fee_created() from public;
revoke all on function public.atlas_notify_finance_fee_created() from anon;
revoke all on function public.atlas_notify_finance_fee_created() from authenticated;

drop trigger if exists atlas_cost_fee_created_notify on public.costs;
create trigger atlas_cost_fee_created_notify
after insert on public.costs
for each row
execute function public.atlas_notify_finance_fee_created();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'atlas_notifications'
  ) then
    alter publication supabase_realtime add table public.atlas_notifications;
  end if;
end $$;
