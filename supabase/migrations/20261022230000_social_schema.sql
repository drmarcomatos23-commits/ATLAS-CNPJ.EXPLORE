-- ATLAS Social (clone do Metricool) — schema isolado "social" no projeto ATLAS FAMILIA.
-- Não altera nada em public, auth (exceto leitura), storage ou outros schemas.

create schema if not exists social;
revoke all on schema social from public, anon;
grant usage on schema social to authenticated, service_role;

create or replace function social.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- Quem pode usar o ATLAS Social (os outros usuários do Atlas Família não veem nada)
create table social.member (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function social.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from social.member m where m.user_id = (select auth.uid()))
$$;
revoke all on function social.is_member() from public, anon;
grant execute on function social.is_member() to authenticated;

-- Conta do Instagram conectada
create table social.ig_account (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ig_user_id text not null unique,
  fb_page_id text not null,
  username text not null,
  account_type text not null check (account_type in ('business','creator')),
  token_secret_id uuid,                      -- id do segredo no Supabase Vault (token nunca em texto puro)
  token_expires_at timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.ig_account(owner_id);

-- Métricas diárias da conta (a Meta apaga após 90 dias; aqui ficam para sempre)
create table social.account_daily_metric (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  day date not null,
  followers_count integer,
  follows integer,
  unfollows integer,
  views integer,
  reach integer,
  accounts_engaged integer,
  total_interactions integer,
  profile_links_taps integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, day)
);
create index on social.account_daily_metric(owner_id);

-- Posts próprios
create table social.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  ig_media_id text not null unique,
  media_type text not null check (media_type in ('IMAGE','VIDEO','CAROUSEL_ALBUM','REELS','STORY')),
  caption text,
  permalink text,
  thumbnail_url text,
  published_at timestamptz not null,
  pillar text check (pillar in ('holding','sucessao','empresas','socios','autoridade','humor','pessoal')),
  is_story boolean not null default false,
  expires_at timestamptz,                    -- stories: published_at + 24h
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.media(owner_id);
create index on social.media(account_id, published_at desc);
create index on social.media(account_id, pillar);

-- Snapshots das métricas do post (curva ao longo do tempo)
create table social.media_metric_snapshot (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references social.media(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views integer,
  reach integer,
  likes integer,
  comments integer,
  saved integer,
  shares integer,
  follows integer,
  total_interactions integer,
  reels_skip_rate numeric(5,2),
  reels_avg_watch_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.media_metric_snapshot(owner_id);
create index on social.media_metric_snapshot(media_id, captured_at desc);

-- Público (cidade, idade, gênero)
create table social.audience_snapshot (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  day date not null,
  dimension text not null check (dimension in ('city','country','age','gender')),
  key text not null,
  value integer not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, day, dimension, key)
);
create index on social.audience_snapshot(owner_id);

-- Seguidores online por hora (base do melhor horário)
create table social.online_followers_hourly (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  day date not null,
  hour smallint not null check (hour between 0 and 23),   -- hora local (America/Sao_Paulo)
  value integer not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, day, hour)
);
create index on social.online_followers_hourly(owner_id);

-- Concorrentes
create table social.competitor (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  username text not null,
  display_name text,
  status text not null default 'active' check (status in ('active','not_supported','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, username)
);
create index on social.competitor(owner_id);

create table social.competitor_daily (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid not null references social.competitor(id) on delete cascade,
  day date not null,
  followers_count integer,
  media_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id, day)
);
create index on social.competitor_daily(owner_id);

create table social.competitor_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid not null references social.competitor(id) on delete cascade,
  ig_media_id text not null,
  media_type text,
  caption text,
  permalink text,
  published_at timestamptz not null,
  like_count integer,
  comments_count integer,
  view_count integer,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id, ig_media_id)
);
create index on social.competitor_media(owner_id);
create index on social.competitor_media(competitor_id, published_at desc);

-- Agendamentos
create table social.scheduled_post (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  post_type text not null check (post_type in ('IMAGE','CAROUSEL','REELS','STORY')),
  caption text check (char_length(caption) <= 2200),
  pillar text check (pillar in ('holding','sucessao','empresas','socios','autoridade','humor','pessoal')),
  scheduled_for timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','publishing','published','failed','canceled')),
  ig_container_id text,
  ig_media_id text,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  last_error text,
  locked_at timestamptz,                     -- trava do worker (evita publicar duas vezes)
  idempotency_key uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.scheduled_post(owner_id);
create index on social.scheduled_post(status, scheduled_for) where status = 'scheduled';

create table social.post_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references social.scheduled_post(id) on delete cascade,
  position smallint not null check (position between 0 and 19),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','video/mp4','video/quicktime')),
  bytes bigint not null check (bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, position)
);
create index on social.post_asset(owner_id);

-- Ideias / rascunhos de pauta
create table social.idea (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  pillar text check (pillar in ('holding','sucessao','empresas','socios','autoridade','humor','pessoal')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.idea(owner_id);

-- Relatórios
create table social.report (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references social.ig_account(id) on delete cascade,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  storage_path text,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.report(owner_id);

-- Log das chamadas à API (controle de limite)
create table social.api_call_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  status_code integer,
  usage_pct numeric(5,2),                    -- lido do cabeçalho de uso da Meta
  called_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on social.api_call_log(owner_id, called_at desc);


do $$
declare t text;
begin
  foreach t in array array['ig_account','account_daily_metric','media','media_metric_snapshot',
    'audience_snapshot','online_followers_hourly','competitor','competitor_daily','competitor_media',
    'scheduled_post','post_asset','idea','report','api_call_log']
  loop
    execute format('create trigger %I_updated before update on social.%I for each row execute function social.set_updated_at()', t, t);
    execute format('alter table social.%I enable row level security', t);
    execute format('create policy %I_owner on social.%I for all to authenticated using (owner_id = (select auth.uid()) and social.is_member()) with check (owner_id = (select auth.uid()) and social.is_member())', t, t);
    execute format('grant select, insert, update, delete on social.%I to authenticated', t);
    execute format('grant all on social.%I to service_role', t);
  end loop;
end $$;

create trigger member_updated before update on social.member for each row execute function social.set_updated_at();
alter table social.member enable row level security;
create policy member_self_read on social.member for select to authenticated using (user_id = (select auth.uid()));
grant select on social.member to authenticated;
grant all on social.member to service_role;

-- Libera o dono (sem id fixo no código)
insert into social.member(user_id)
select id from auth.users where lower(email) = 'dr.marcomatos23@gmail.com'
on conflict do nothing;
