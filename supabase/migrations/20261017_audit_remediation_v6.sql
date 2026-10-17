-- ATLAS Legalização — remediações da auditoria V6.
-- Preparada em branch de preview. Não aplicar em produção sem homologação expressa.

create or replace function public.atlas_list_archived_clients()
returns table(
  id uuid,
  legal_name text,
  trade_name text,
  tax_id text,
  city text,
  state text,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where public.profiles.id = auth.uid();

  if v_profile.id is null or not v_profile.active or v_profile.role <> 'admin' then
    raise exception 'Apenas Administrador pode consultar empresas arquivadas.';
  end if;

  return query
  select
    c.id,
    c.legal_name,
    c.trade_name,
    c.tax_id,
    c.city,
    c.state::text,
    c.deleted_at
  from public.clients c
  where c.organization_id = v_profile.organization_id
    and c.deleted_at is not null
  order by c.deleted_at desc;
end;
$function$;

-- Compatibilidade com consultas financeiras antigas sem inventar data histórica.
-- Registros já existentes permanecem nulos; somente novos registros recebem now().
alter table public.costs
  add column if not exists created_at timestamptz;

alter table public.costs
  alter column created_at set default now();

comment on column public.costs.created_at is
  'Timestamp de criação para novos lançamentos; registros anteriores à migração permanecem nulos para não inventar histórico.';
