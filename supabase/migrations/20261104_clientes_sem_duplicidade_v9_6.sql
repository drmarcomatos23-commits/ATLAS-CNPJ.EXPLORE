-- V9.6 — Impede cadastro de empresa em duplicidade (vale para qualquer tela e para a API).
-- 1) CNPJ: único por organização (inclui arquivadas: restaura-se a arquivada em vez de recadastrar).
-- 2) Sem CNPJ (empresa em constituição): nome não pode repetir o de outra empresa da organização.
-- 3) Com CNPJ, mas já existe a mesma razão social cadastrada SEM CNPJ: bloqueia e orienta a completar o cadastro existente.
-- Filiais (mesmo nome, CNPJs diferentes) continuam permitidas. Registros antigos não são alterados.

create or replace function atlas_private.company_name_key(p text)
returns text language sql immutable parallel safe as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(
               translate(upper(coalesce(p, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN'),
               '[^A-Z0-9 ]', ' ', 'g'),
             '\s+(LTDA|ME|EPP|EIRELI|S\s?A|SLU|SS|SIMPLES)\s*$', '', 'g'),
           '\s+', ' ', 'g'))
$$;

create unique index if not exists clients_org_cnpj_unique
  on public.clients (organization_id, (regexp_replace(tax_id, '\D', '', 'g')))
  where length(regexp_replace(coalesce(tax_id, ''), '\D', '', 'g')) = 14;

create or replace function public.atlas_find_client_duplicate(p_cnpj text, p_name text, p_exclude_id uuid default null)
returns table(id uuid, legal_name text, tax_id text, archived boolean, motivo text)
language sql stable security definer set search_path = public as $$
  with k as (
    select regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g') d, atlas_private.company_name_key(p_name) n
  )
  select c.id, c.legal_name, c.tax_id, (c.deleted_at is not null),
         case when length(k.d) = 14 and regexp_replace(coalesce(c.tax_id, ''), '\D', '', 'g') = k.d then 'cnpj'
              when length(k.d) = 14 then 'nome_sem_cnpj'
              else 'nome' end
  from public.clients c, k
  where c.organization_id = public.current_org_id()
    and (p_exclude_id is null or c.id <> p_exclude_id)
    and (
      (length(k.d) = 14 and regexp_replace(coalesce(c.tax_id, ''), '\D', '', 'g') = k.d)
      or (k.n <> '' and atlas_private.company_name_key(c.legal_name) = k.n and c.deleted_at is null
          and (length(k.d) <> 14 or length(regexp_replace(coalesce(c.tax_id, ''), '\D', '', 'g')) <> 14))
    )
  order by (length(k.d) = 14 and regexp_replace(coalesce(c.tax_id, ''), '\D', '', 'g') = k.d) desc, c.deleted_at nulls first
  limit 1
$$;
grant execute on function public.atlas_find_client_duplicate(text, text, uuid) to authenticated;

create or replace function atlas_private.prevent_duplicate_client()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d text := regexp_replace(coalesce(new.tax_id, ''), '\D', '', 'g');
  n text := atlas_private.company_name_key(new.legal_name);
  dup record;
begin
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.deleted_at is null
     and coalesce(old.tax_id, '') = coalesce(new.tax_id, '')
     and coalesce(old.legal_name, '') = coalesce(new.legal_name, '') then
    return new;
  end if;
  if length(d) = 14 then
    select c.legal_name, c.deleted_at into dup from public.clients c
     where c.organization_id = new.organization_id and c.id <> new.id
       and regexp_replace(coalesce(c.tax_id, ''), '\D', '', 'g') = d limit 1;
    if found then
      raise exception 'ATLAS_DUPLICIDADE: o CNPJ % já está cadastrado para "%"%.', new.tax_id, dup.legal_name,
        case when dup.deleted_at is not null then ' (empresa arquivada — restaure o cadastro)' else '' end
        using errcode = '23505';
    end if;
  end if;
  if n <> '' then
    select c.legal_name into dup from public.clients c
     where c.organization_id = new.organization_id and c.id <> new.id and c.deleted_at is null
       and atlas_private.company_name_key(c.legal_name) = n
       and (length(d) <> 14 or length(regexp_replace(coalesce(c.tax_id, ''), '\D', '', 'g')) <> 14)
     limit 1;
    if found then
      raise exception 'ATLAS_DUPLICIDADE: já existe a empresa "%"%.', dup.legal_name,
        case when length(d) = 14 then ' cadastrada sem CNPJ — abra esse cadastro e informe o CNPJ nele' else ' com o mesmo nome' end
        using errcode = '23505';
    end if;
  end if;
  return new;
end $$;

create or replace trigger atlas_prevent_duplicate_client
  before insert or update of tax_id, legal_name, deleted_at on public.clients
  for each row execute function atlas_private.prevent_duplicate_client();
