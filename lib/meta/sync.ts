import 'server-only';
import { supabaseService } from '../supabase/server';
import { businessDiscovery, graph, graphAll, GraphError, insightMap, MEDIA_FIELDS, mediaInsightMetrics, type CallInfo, type IgMedia, type InsightValue } from './graph';

// Coleta: roda no servidor com o service_role. Cada linha grava owner_id da conta.

type Sb = ReturnType<typeof supabaseService>;
export type Scope = 'recent' | 'daily' | 'competitors' | 'initial';

interface Account { id: string; owner_id: string; ig_user_id: string }

const USAGE_PAUSE = 80;

class Ctx {
  maxUsage = 0;
  calls = 0;
  constructor(public sb: Sb, public acc: Account, public token: string) {}
  onCall = (c: CallInfo) => {
    this.calls++;
    if (c.usagePct !== null) this.maxUsage = Math.max(this.maxUsage, c.usagePct);
    void this.sb.from('api_call_log').insert({ owner_id: this.acc.owner_id, endpoint: c.endpoint, status_code: c.status, usage_pct: c.usagePct });
  };
  get throttled() { return this.maxUsage >= USAGE_PAUSE; }
}

function typeOf(m: IgMedia): 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS' | 'STORY' {
  if (m.media_product_type === 'STORY') return 'STORY';
  if (m.media_product_type === 'REELS') return 'REELS';
  return m.media_type;
}

async function saveMediaWithInsights(ctx: Ctx, list: IgMedia[], insightsFor: (m: IgMedia) => boolean) {
  if (!list.length) return { media: 0, snapshots: 0 };
  const rows = list.map((m) => ({
    owner_id: ctx.acc.owner_id, account_id: ctx.acc.id, ig_media_id: m.id, media_type: typeOf(m),
    caption: m.caption ?? null, permalink: m.permalink ?? null, thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
    published_at: m.timestamp, is_story: m.media_product_type === 'STORY',
    expires_at: m.media_product_type === 'STORY' ? new Date(new Date(m.timestamp).getTime() + 86_400_000).toISOString() : null,
  }));
  // pilar não é sobrescrito: não está no upsert
  const { data: saved, error } = await ctx.sb.from('media').upsert(rows, { onConflict: 'ig_media_id' }).select('id,ig_media_id');
  if (error) throw new Error(`media upsert: ${error.message}`);
  const idOf = new Map((saved ?? []).map((r) => [r.ig_media_id, r.id]));

  let snapshots = 0;
  for (const m of list) {
    if (!insightsFor(m) || ctx.throttled) continue;
    let ins: Record<string, number> = {};
    try {
      const res = await graph<{ data: InsightValue[] }>(`${m.id}/insights`, ctx.token, { metric: mediaInsightMetrics(m) }, { onCall: ctx.onCall });
      ins = insightMap(res.data);
    } catch (e) {
      // Story com menos de 5 views ou post antigo sem dados: grava só curtidas/comentários
      if (!(e instanceof GraphError)) throw e;
    }
    const watch = ins.ig_reels_avg_watch_time;
    const { error: e2 } = await ctx.sb.from('media_metric_snapshot').insert({
      owner_id: ctx.acc.owner_id, media_id: idOf.get(m.id),
      views: ins.views ?? null, reach: ins.reach ?? null, likes: m.like_count ?? null, comments: m.comments_count ?? null,
      saved: ins.saved ?? null, shares: ins.shares ?? null, follows: ins.follows ?? null,
      total_interactions: ins.total_interactions ?? null, reels_avg_watch_ms: typeof watch === 'number' ? Math.round(watch) : null,
    });
    if (e2) throw new Error(`snapshot: ${e2.message}`);
    snapshots++;
  }
  return { media: list.length, snapshots };
}

async function syncMedia(ctx: Ctx, scope: Scope) {
  const max = scope === 'initial' ? 300 : scope === 'recent' ? 25 : 300;
  const list = await graphAll<IgMedia>(`${ctx.acc.ig_user_id}/media`, ctx.token, { fields: MEDIA_FIELDS }, max, ctx.onCall);
  const now = Date.now();
  const twoYears = 730 * 86_400_000;
  const insightsFor = (m: IgMedia) => {
    const age = now - new Date(m.timestamp).getTime();
    if (scope === 'recent') return age <= 72 * 3_600_000; // curva das primeiras 72 h
    return age <= twoYears; // Meta guarda métricas de post por 2 anos
  };
  return saveMediaWithInsights(ctx, list, insightsFor);
}

async function syncStories(ctx: Ctx) {
  const res = await graph<{ data: IgMedia[] }>(`${ctx.acc.ig_user_id}/stories`, ctx.token, { fields: MEDIA_FIELDS }, { onCall: ctx.onCall });
  const list = res.data.map((m) => ({ ...m, media_product_type: 'STORY' as const }));
  return saveMediaWithInsights(ctx, list, () => true);
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

async function syncAccountDaily(ctx: Ctx) {
  const ig = ctx.acc.ig_user_id;
  // Reprocessa os últimos 3 dias: a Meta pode atrasar até 48 h.
  for (let back = 3; back >= 1; back--) {
    if (ctx.throttled) break;
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - back));
    const end = new Date(start.getTime() + 86_400_000);
    const since = String(Math.floor(start.getTime() / 1000));
    const until = String(Math.floor(end.getTime() / 1000));
    const totals = await graph<{ data: InsightValue[] }>(`${ig}/insights`, ctx.token, {
      metric: 'views,reach,accounts_engaged,total_interactions,profile_links_taps',
      period: 'day', metric_type: 'total_value', since, until,
    }, { onCall: ctx.onCall }).catch(() => ({ data: [] as InsightValue[] }));
    const t = insightMap(totals.data);
    // Seguidores ganhos são calculados pela diferença diária de followers_count (mais confiável).
    await ctx.sb.from('account_daily_metric').upsert({
      owner_id: ctx.acc.owner_id, account_id: ctx.acc.id, day: dayStr(start),
      views: t.views ?? null, reach: t.reach ?? null, accounts_engaged: t.accounts_engaged ?? null,
      total_interactions: t.total_interactions ?? null, profile_links_taps: t.profile_links_taps ?? null,
    }, { onConflict: 'account_id,day' });
  }
  // Seguidores de hoje (campo do perfil, sempre disponível)
  const me = await graph<{ followers_count?: number }>(ig, ctx.token, { fields: 'followers_count' }, { onCall: ctx.onCall });
  await ctx.sb.from('account_daily_metric').upsert({
    owner_id: ctx.acc.owner_id, account_id: ctx.acc.id, day: dayStr(new Date()), followers_count: me.followers_count ?? null,
  }, { onConflict: 'account_id,day' });

  // Seguidores online por hora (precisa de 100+ seguidores; últimos 30 dias)
  const online = await graph<{ data: { values: { value: Record<string, number>; end_time: string }[] }[] }>(
    `${ig}/insights`, ctx.token, { metric: 'online_followers', period: 'lifetime' }, { onCall: ctx.onCall },
  ).catch(() => ({ data: [] }));
  const rows: { owner_id: string; account_id: string; day: string; hour: number; value: number }[] = [];
  for (const v of online.data[0]?.values ?? []) {
    const dayStart = new Date(v.end_time).getTime() - 86_400_000;
    for (const [h, value] of Object.entries(v.value ?? {})) {
      // As chaves vêm como hora do dia relativa ao início do período; convertemos para hora de Brasília.
      // Conferir com os primeiros dados reais (ver docs/replica/build-log.md).
      const local = new Date(dayStart + Number(h) * 3_600_000);
      const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(local);
      const g = (t: string) => p.find((x) => x.type === t)!.value;
      rows.push({ owner_id: ctx.acc.owner_id, account_id: ctx.acc.id, day: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')), value });
    }
  }
  if (rows.length) await ctx.sb.from('online_followers_hourly').upsert(rows, { onConflict: 'account_id,day,hour' });
}

async function syncAudience(ctx: Ctx) {
  const day = dayStr(new Date());
  for (const [breakdown, dimension] of [['city', 'city'], ['age', 'age'], ['gender', 'gender'], ['country', 'country']] as const) {
    if (ctx.throttled) break;
    const res = await graph<{ data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] }>(
      `${ctx.acc.ig_user_id}/insights`, ctx.token,
      { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', timeframe: 'this_month', breakdown },
      { onCall: ctx.onCall },
    ).catch(() => ({ data: [] }));
    const results = res.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    const rows = results.map((r) => ({ owner_id: ctx.acc.owner_id, account_id: ctx.acc.id, day, dimension, key: r.dimension_values.join(' · '), value: r.value }));
    if (rows.length) await ctx.sb.from('audience_snapshot').upsert(rows, { onConflict: 'account_id,day,dimension,key' });
  }
}

export async function syncCompetitor(ctx: Ctx, comp: { id: string; username: string }) {
  try {
    const res = await businessDiscovery(ctx.acc.ig_user_id, comp.username, ctx.token, ctx.onCall);
    const bd = res.business_discovery;
    await ctx.sb.from('competitor').update({ status: 'active', display_name: bd.name ?? null }).eq('id', comp.id);
    await ctx.sb.from('competitor_daily').upsert({
      owner_id: ctx.acc.owner_id, competitor_id: comp.id, day: dayStr(new Date()),
      followers_count: bd.followers_count ?? null, media_count: bd.media_count ?? null,
    }, { onConflict: 'competitor_id,day' });
    const media = (bd.media?.data ?? []).map((m) => ({
      owner_id: ctx.acc.owner_id, competitor_id: comp.id, ig_media_id: m.id, media_type: m.media_type ?? null,
      caption: m.caption ?? null, permalink: m.permalink ?? null, published_at: m.timestamp,
      like_count: m.like_count ?? null, comments_count: m.comments_count ?? null, view_count: m.view_count ?? null,
      last_seen_at: new Date().toISOString(),
    }));
    if (media.length) await ctx.sb.from('competitor_media').upsert(media, { onConflict: 'competitor_id,ig_media_id' });
    return 'active' as const;
  } catch (e) {
    if (e instanceof GraphError && (e.code === 110 || e.code === 100 || e.status === 400)) {
      await ctx.sb.from('competitor').update({ status: 'not_supported' }).eq('id', comp.id);
      return 'not_supported' as const;
    }
    throw e;
  }
}

export async function contextFor(accountId: string): Promise<Ctx> {
  const sb = supabaseService();
  const { data: acc, error } = await sb.from('ig_account').select('id,owner_id,ig_user_id').eq('id', accountId).single();
  if (error || !acc) throw new Error('Conta não encontrada');
  const { data: token, error: e2 } = await sb.rpc('get_account_token', { p_account: accountId });
  if (e2 || !token) throw new Error('Token da Meta não encontrado — conecte a conta de novo');
  return new Ctx(sb, acc, token as string);
}

export async function runSync(accountId: string, scope: Scope) {
  const ctx = await contextFor(accountId);
  const out: Record<string, unknown> = { scope };
  if (scope === 'recent') {
    out.media = await syncMedia(ctx, 'recent');
    out.stories = await syncStories(ctx).catch((e) => ({ error: String(e.message ?? e) }));
  } else if (scope === 'daily' || scope === 'initial') {
    out.media = await syncMedia(ctx, scope);
    out.stories = await syncStories(ctx).catch((e) => ({ error: String(e.message ?? e) }));
    await syncAccountDaily(ctx);
    if (scope === 'initial' || new Date().getUTCDay() === 1) await syncAudience(ctx); // semanal (segunda)
  } else if (scope === 'competitors') {
    const { data: comps } = await ctx.sb.from('competitor').select('id,username').eq('account_id', accountId).neq('status', 'paused');
    const results: Record<string, string> = {};
    for (const c of comps ?? []) {
      if (ctx.throttled) { results[c.username] = 'adiado (limite da API)'; continue; }
      results[c.username] = await syncCompetitor(ctx, c);
    }
    out.competitors = results;
  }
  await ctx.sb.from('ig_account').update({ last_synced_at: new Date().toISOString() }).eq('id', accountId);
  out.calls = ctx.calls;
  out.maxUsagePct = ctx.maxUsage;
  return out;
}
