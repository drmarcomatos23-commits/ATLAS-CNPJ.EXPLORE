-- ATLAS Legalização V8.6 — Financeiro do processo
-- Aplicada em produção via MCP em 3 passos: financeiro_processo_v8_6, financeiro_formato_brl_v8_6
-- e ajuste de capitalização. Este arquivo registra o estado final.

create or replace function atlas_private.brl(v numeric)
returns text language sql immutable set search_path = pg_catalog as $$
  select 'R$ ' || translate(to_char(coalesce(v,0), 'FM999,999,999,990.00'), ',.', '.,')
$$;
revoke all on function atlas_private.brl(numeric) from public, anon, authenticated;

-- Aviso no sino (Admin, Financeiro e responsável) quando um processo é concluído
-- com honorários a receber ou taxas pagas pelo escritório ainda sem reembolso.
create or replace function atlas_private.notify_completion_finance()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare fee numeric; reimb numeric; parts text[];
begin
  if new.status <> 'completed' or old.status is not distinct from 'completed' or new.deleted_at is not null then return null; end if;
  select coalesce(sum(amount) filter (where fee_kind = 'honorarios' and coalesce(payment_status,'pending') <> 'paid'),0),
         coalesce(sum(amount) filter (where coalesce(fee_kind,'') <> 'honorarios' and payment_status = 'paid' and coalesce(reimbursement_status,'pending') not in ('reimbursed','not_applicable')),0)
    into fee, reimb from public.costs where process_id = new.id;
  if fee <= 0 and reimb <= 0 then return null; end if;
  parts := array_remove(array[
    case when fee > 0 then 'honorários a receber ' || atlas_private.brl(fee) end,
    case when reimb > 0 then 'taxas a reembolsar ' || atlas_private.brl(reimb) end], null);
  insert into public.atlas_notifications (organization_id, recipient_profile_id, event_type, title, body, process_id, client_id, metadata)
  select new.organization_id, a.user_id, 'finance_pending',
    'Processo concluído com pendência financeira: ' || coalesce(new.public_code, ''),
    upper(left(array_to_string(parts, ' · '),1)) || substr(array_to_string(parts, ' · '),2) || ' · ' || coalesce(new.title, ''),
    new.id, new.client_id, jsonb_build_object('dedupe_key', 'fin:' || new.id, 'honorarios', fee, 'reembolso', reimb)
  from public.atlas_hub_system_access a join public.profiles p on p.id = a.user_id and p.active
  where a.organization_id = new.organization_id and a.system_key = 'legalizacao' and a.allowed
    and (a.system_role in ('admin','financeiro') or a.user_id = new.owner_id)
    and not exists (select 1 from public.atlas_notifications x where x.recipient_profile_id = a.user_id and x.metadata ->> 'dedupe_key' = 'fin:' || new.id);
  return null;
end $$;
revoke all on function atlas_private.notify_completion_finance() from public, anon, authenticated;
create or replace trigger trg_notify_completion_finance after update of status on public.processes
for each row execute function atlas_private.notify_completion_finance();

-- O resumo das 08:40 (atlas_private.generate_daily_summary) passou a incluir, para Admin e Financeiro,
-- "honorários vencidos" e "taxas a reembolsar" de processos concluídos (patch aplicado sobre a V8.4).
