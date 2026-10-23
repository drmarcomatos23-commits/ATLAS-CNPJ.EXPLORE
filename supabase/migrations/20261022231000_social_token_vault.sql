-- Tokens da Meta guardados no Supabase Vault (criptografados). Só o service_role (servidor) acessa.

create or replace function social.set_account_token(p_account uuid, p_token text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret uuid;
begin
  select token_secret_id into v_secret from social.ig_account where id = p_account for update;
  if not found then raise exception 'conta % não encontrada', p_account; end if;
  if v_secret is null then
    v_secret := vault.create_secret(p_token, 'social_ig_' || p_account::text, 'Token Meta do ATLAS Social');
  else
    perform vault.update_secret(v_secret, p_token);
  end if;
  update social.ig_account set token_secret_id = v_secret, token_expires_at = p_expires_at where id = p_account;
end $$;

create or replace function social.get_account_token(p_account uuid)
returns text language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from social.ig_account a
  join vault.decrypted_secrets s on s.id = a.token_secret_id
  where a.id = p_account
$$;

revoke all on function social.set_account_token(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function social.get_account_token(uuid) from public, anon, authenticated;
grant execute on function social.set_account_token(uuid, text, timestamptz) to service_role;
grant execute on function social.get_account_token(uuid) to service_role;
