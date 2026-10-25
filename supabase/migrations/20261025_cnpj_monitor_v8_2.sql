-- ATLAS Legalização V8.2 — Monitor de CNPJ da carteira (custo zero)
-- Token da rotina guardado no Vault; pg_cron chama a Edge Function atlas-legalizacao-cnpj-monitor
-- de hora em hora (lotes de 12). Cada empresa é reconferida a cada ~7 dias.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'atlas_legalizacao_cnpj_cron_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'atlas_legalizacao_cnpj_cron_token', 'Token do monitoramento de CNPJ do ATLAS Legalização');
  end if;
  if not exists (select 1 from cron.job where jobname = 'atlas-legalizacao-cnpj-monitor') then
    perform cron.schedule('atlas-legalizacao-cnpj-monitor', '23 * * * *', $cmd$
 select net.http_post(
  url:='https://oorpvbxxpbxoaaykrtcf.supabase.co/functions/v1/atlas-legalizacao-cnpj-monitor',
  headers:=jsonb_build_object('Content-Type','application/json','x-atlas-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='atlas_legalizacao_cnpj_cron_token')),
  body:='{"limit":12}'::jsonb, timeout_milliseconds:=140000);
$cmd$);
  end if;
end $$;

create index if not exists idx_client_registry_snapshots_client_source on public.client_registry_snapshots (client_id, source, fetched_at desc);
