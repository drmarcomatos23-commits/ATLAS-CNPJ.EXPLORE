-- Replica · clone do Metricool (uso próprio) · Postgres 15+ / Supabase
-- Todas as datas em timestamptz (UTC). Exibição em America/Sao_Paulo.
-- Acesso: RLS por owner_id = auth.uid() em todas as tabelas.

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Conta do Instagram conectada
create table ig_account (
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
create index on ig_account(owner_id);

-- Métricas diárias da conta (a Meta apaga após 90 dias; aqui ficam para sempre)
create table account_daily_metric (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
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
create index on account_daily_metric(owner_id);

-- Posts próprios
create table media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
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
create index on media(owner_id);
create index on media(account_id, published_at desc);
create index on media(account_id, pillar);

-- Snapshots das métricas do post (curva ao longo do tempo)
create table media_metric_snapshot (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
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
create index on media_metric_snapshot(owner_id);
create index on media_metric_snapshot(media_id, captured_at desc);

-- Público (cidade, idade, gênero)
create table audience_snapshot (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
  day date not null,
  dimension text not null check (dimension in ('city','country','age','gender')),
  key text not null,
  value integer not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, day, dimension, key)
);
create index on audience_snapshot(owner_id);

-- Seguidores online por hora (base do melhor horário)
create table online_followers_hourly (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
  day date not null,
  hour smallint not null check (hour between 0 and 23),   -- hora local (America/Sao_Paulo)
  value integer not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, day, hour)
);
create index on online_followers_hourly(owner_id);

-- Concorrentes
create table competitor (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
  username text not null,
  display_name text,
  status text not null default 'active' check (status in ('active','not_supported','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, username)
);
create index on competitor(owner_id);

create table competitor_daily (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid not null references competitor(id) on delete cascade,
  day date not null,
  followers_count integer,
  media_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id, day)
);
create index on competitor_daily(owner_id);

create table competitor_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  competitor_id uuid not null references competitor(id) on delete cascade,
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
create index on competitor_media(owner_id);
create index on competitor_media(competitor_id, published_at desc);

-- Agendamentos
create table scheduled_post (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
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
create index on scheduled_post(owner_id);
create index on scheduled_post(status, scheduled_for) where status = 'scheduled';

create table post_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references scheduled_post(id) on delete cascade,
  position smallint not null check (position between 0 and 19),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','video/mp4','video/quicktime')),
  bytes bigint not null check (bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, position)
);
create index on post_asset(owner_id);

-- Ideias / rascunhos de pauta
create table idea (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  pillar text check (pillar in ('holding','sucessao','empresas','socios','autoridade','humor','pessoal')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on idea(owner_id);

-- Relatórios
create table report (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references ig_account(id) on delete cascade,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  storage_path text,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on report(owner_id);

-- Log das chamadas à API (controle de limite)
create table api_call_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  status_code integer,
  usage_pct numeric(5,2),                    -- lido do cabeçalho de uso da Meta
  called_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on api_call_log(owner_id, called_at desc);

-- Gatilhos updated_at + RLS em todas as tabelas
do $$
declare t text;
begin
  foreach t in array array['ig_account','account_daily_metric','media','media_metric_snapshot',
    'audience_snapshot','online_followers_hourly','competitor','competitor_daily','competitor_media',
    'scheduled_post','post_asset','idea','report','api_call_log']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;
