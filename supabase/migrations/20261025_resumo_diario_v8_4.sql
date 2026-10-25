-- ATLAS Legalização V8.4 — Resumo do dia no sino às 08:40 (Brasília)
-- Um aviso por usuário (Admin/Operação) com: tarefas dele para hoje/atrasadas/risco de data legal,
-- vencimentos de hoje, vencidos e próximos 30 dias, exigências e protocolos a verificar.
-- Só é enviado quando há algo pendente. O cron das 08:40 roda os alertas escalonados e o resumo.

create or replace function atlas_private.generate_daily_summary()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  n integer := 0; k integer;
  lic_today int; lic_late int; lic_30 int; req_due int; req_late int; proto_check int;
  t_today int; t_late int; t_risk int; parts text[];
begin
  for r in
    select a.user_id, a.organization_id
    from public.atlas_hub_system_access a join public.profiles p on p.id = a.user_id and p.active
    where a.system_key = 'legalizacao' and a.allowed and a.system_role in ('admin','operacao')
  loop
    select count(*) filter (where l.expires_at = today),
           count(*) filter (where l.expires_at < today and coalesce(l.status,'active') <> 'renewing'),
           count(*) filter (where l.expires_at > today and l.expires_at <= today + 30)
      into lic_today, lic_late, lic_30
    from public.licenses l join public.clients c on c.id = l.client_id and c.deleted_at is null
    where c.organization_id = r.organization_id and l.expires_at is not null
      and coalesce(l.status,'active') not in ('not_applicable','cancelled');

    select count(*) filter (where q.due_date >= today and q.due_date <= today + 3),
           count(*) filter (where q.due_date < today)
      into req_due, req_late
    from public.process_requirements q
    where q.organization_id = r.organization_id and q.status in ('aberta','em_atendimento') and q.due_date is not null;

    select count(*) into proto_check
    from public.protocols pt join public.processes pr on pr.id = pt.process_id and pr.deleted_at is null
    where pr.organization_id = r.organization_id and pt.next_action_at is not null
      and (pt.next_action_at at time zone 'America/Sao_Paulo')::date <= today
      and coalesce(pt.status,'') !~* '(deferido|indeferido|arquivado|cancelado|conclu)';

    select count(*) filter (where k2.target_date = today),
           count(*) filter (where k2.target_date < today),
           count(*) filter (where k2.legal_date is not null and k2.legal_date <= today + 3)
      into t_today, t_late, t_risk
    from public.process_tasks k2 join public.processes pr on pr.id = k2.process_id and pr.deleted_at is null
      and coalesce(pr.status,'') not in ('completed','cancelled')
    where k2.organization_id = r.organization_id and k2.status = 'aberta'
      and coalesce(k2.assignee_id, pr.owner_id) = r.user_id;

    parts := array_remove(array[
      case when t_today > 0 then t_today || ' tarefa(s) sua(s) para hoje' end,
      case when t_late > 0 then t_late || ' tarefa(s) sua(s) atrasada(s)' end,
      case when t_risk > 0 then t_risk || ' com data legal em até 3 dias' end,
      case when lic_today > 0 then lic_today || ' vencimento(s) hoje' end,
      case when lic_late > 0 then lic_late || ' documento(s) vencido(s)' end,
      case when lic_30 > 0 then lic_30 || ' vencem em 30 dias' end,
      case when req_late > 0 then req_late || ' exigência(s) vencida(s)' end,
      case when req_due > 0 then req_due || ' exigência(s) em até 3 dias' end,
      case when proto_check > 0 then proto_check || ' protocolo(s) para verificar' end
    ], null);

    if array_length(parts, 1) is null then continue; end if;

    insert into public.atlas_notifications (organization_id, recipient_profile_id, event_type, title, body, metadata)
    select r.organization_id, r.user_id, 'daily_summary',
      'Resumo do dia · ' || to_char(today, 'DD/MM'),
      array_to_string(parts, ' · '),
      jsonb_build_object('dedupe_key', 'summary:' || today, 'tarefas_hoje', t_today, 'tarefas_atrasadas', t_late,
        'risco_legal', t_risk, 'vencem_hoje', lic_today, 'vencidos', lic_late, 'vencem_30', lic_30,
        'exigencias_3d', req_due, 'exigencias_vencidas', req_late, 'protocolos', proto_check)
    where not exists (select 1 from public.atlas_notifications x
      where x.recipient_profile_id = r.user_id and x.metadata ->> 'dedupe_key' = 'summary:' || today);
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $$;

-- Sino às 08:40 (Brasília) = 11:40 UTC: alertas escalonados + resumo do dia.
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'atlas-legalizacao-alertas-diario';
  if jid is not null then
    perform cron.alter_job(jid, schedule := '40 11 * * *',
      command := 'select atlas_private.generate_legalizacao_alerts(); select atlas_private.generate_daily_summary();');
  else
    perform cron.schedule('atlas-legalizacao-alertas-diario', '40 11 * * *',
      'select atlas_private.generate_legalizacao_alerts(); select atlas_private.generate_daily_summary();');
  end if;
end $$;
