import 'server-only';
import { isDemo, supabaseUser } from '../supabase/server';
import { DEMO_ACCOUNT, DEMO_COMPETITORS, DEMO_POSTS, demoCompetitor, demoSeries, demoSnapshots } from './demo';
import { bestTimes, type Cell } from '../best-times';
import { postsPerWeek, sortBy, followsPerThousand } from '../metrics';
import type { AccountInfo, CompetitorDetail, CompetitorRow, DailyPoint, MediaType, Overview, Pillar, PostRow, Snapshot, SortKey } from '../types';

// Mesma interface para dados reais (Supabase, schema social) e demonstração.

export interface PostFilter { type?: MediaType | 'all'; pillar?: Pillar | 'all'; days?: number; sort?: SortKey; dir?: 'asc' | 'desc' }

function sortKey(k: SortKey) {
  return (p: PostRow): number | string | null =>
    k === 'publishedAt' ? p.publishedAt : k === 'conversion' ? followsPerThousand(p) : (p[k] as number | null);
}

function applyFilter(rows: PostRow[], f: PostFilter): PostRow[] {
  const since = f.days ? Date.now() - f.days * 86_400_000 : null;
  const filtered = rows.filter((p) =>
    (!f.type || f.type === 'all' || p.mediaType === f.type) &&
    (!f.pillar || f.pillar === 'all' || p.pillar === f.pillar) &&
    (since === null || new Date(p.publishedAt).getTime() >= since));
  return sortBy(filtered, sortKey(f.sort ?? 'publishedAt'), f.dir ?? 'desc');
}

type SnapRow = { views: number | null; reach: number | null; likes: number | null; comments: number | null; saved: number | null; shares: number | null; follows: number | null; captured_at: string };
type MediaRow = { id: string; media_type: MediaType; caption: string | null; permalink: string | null; thumbnail_url: string | null; published_at: string; pillar: Pillar | null; media_metric_snapshot: SnapRow[] };

function toPost(m: MediaRow): PostRow {
  const s = m.media_metric_snapshot?.[0];
  return {
    id: m.id, mediaType: m.media_type, caption: m.caption ?? '', permalink: m.permalink, thumbnailUrl: m.thumbnail_url,
    publishedAt: m.published_at, pillar: m.pillar,
    views: s?.views ?? null, reach: s?.reach ?? null, likes: s?.likes ?? null, comments: s?.comments ?? null,
    saved: s?.saved ?? null, shares: s?.shares ?? null, follows: s?.follows ?? null,
  };
}

export async function getAccount(): Promise<AccountInfo | null> {
  if (isDemo()) return DEMO_ACCOUNT;
  const sb = await supabaseUser();
  const { data: acc } = await sb.from('ig_account').select('id,username,account_type,last_synced_at,token_expires_at').limit(1).maybeSingle();
  if (!acc) return null;
  const { data: last } = await sb.from('account_daily_metric').select('followers_count').eq('account_id', acc.id)
    .not('followers_count', 'is', null).order('day', { ascending: false }).limit(1).maybeSingle();
  return {
    username: acc.username, accountType: acc.account_type, followers: last?.followers_count ?? null,
    lastSyncedAt: acc.last_synced_at, tokenExpiresAt: acc.token_expires_at,
  };
}

export async function listPosts(f: PostFilter = {}): Promise<PostRow[]> {
  if (isDemo()) return applyFilter(DEMO_POSTS, f);
  const sb = await supabaseUser();
  const { data, error } = await sb.from('media')
    .select('id,media_type,caption,permalink,thumbnail_url,published_at,pillar,media_metric_snapshot(views,reach,likes,comments,saved,shares,follows,captured_at)')
    .eq('is_story', false)
    .order('published_at', { ascending: false })
    .order('captured_at', { referencedTable: 'media_metric_snapshot', ascending: false })
    .limit(1, { referencedTable: 'media_metric_snapshot' })
    .limit(1000);
  if (error) throw new Error(error.message);
  return applyFilter((data as unknown as MediaRow[]).map(toPost), f);
}

export async function getPost(id: string): Promise<{ post: PostRow; snapshots: Snapshot[] } | null> {
  if (isDemo()) {
    const post = DEMO_POSTS.find((p) => p.id === id);
    return post ? { post, snapshots: demoSnapshots(post) } : null;
  }
  const sb = await supabaseUser();
  const { data: m } = await sb.from('media').select('id,media_type,caption,permalink,thumbnail_url,published_at,pillar').eq('id', id).maybeSingle();
  if (!m) return null;
  const { data: snaps } = await sb.from('media_metric_snapshot').select('views,reach,likes,comments,saved,shares,follows,captured_at')
    .eq('media_id', id).order('captured_at', { ascending: true }).limit(500);
  const rows = (snaps ?? []) as SnapRow[];
  const post = toPost({ ...(m as Omit<MediaRow, 'media_metric_snapshot'>), media_metric_snapshot: rows.length ? [rows[rows.length - 1]] : [] });
  return { post, snapshots: rows.map((s) => ({ ...s, capturedAt: s.captured_at })) };
}

export async function setPillar(id: string, pillar: Pillar | null): Promise<void> {
  if (isDemo()) return;
  const sb = await supabaseUser();
  const { error } = await sb.from('media').update({ pillar }).eq('id', id);
  if (error) throw new Error(error.message);
}

async function series(days: number): Promise<DailyPoint[]> {
  if (isDemo()) return demoSeries(days);
  const sb = await supabaseUser();
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await sb.from('account_daily_metric').select('day,followers_count,views,reach,profile_links_taps')
    .gte('day', from).order('day', { ascending: true });
  return (data ?? []).map((d) => ({ day: d.day, followers: d.followers_count, views: d.views, reach: d.reach, linkTaps: d.profile_links_taps }));
}

const sum = (xs: (number | null)[]) => (xs.some((x) => x !== null) ? xs.reduce<number>((a, b) => a + (b ?? 0), 0) : null);

export async function getOverview(days = 30): Promise<Overview> {
  const all = await series(days * 2);
  const cut = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const cur = all.filter((d) => d.day >= cut);
  const prev = all.filter((d) => d.day < cut);
  const lastF = (xs: DailyPoint[]) => [...xs].reverse().find((d) => d.followers !== null)?.followers ?? null;
  const firstF = (xs: DailyPoint[]) => xs.find((d) => d.followers !== null)?.followers ?? null;
  const posts = await listPosts({ days });
  const prevPosts = (await listPosts({ days: days * 2 })).filter((p) => !posts.some((q) => q.id === p.id));
  const gained = (a: number | null, b: number | null) => (a !== null && b !== null ? a - b : null);
  return {
    kpis: [
      { key: 'followers', label: 'Seguidores', value: lastF(cur), previous: lastF(prev) },
      { key: 'gained', label: 'Seguidores ganhos', value: gained(lastF(cur), firstF(cur)), previous: gained(lastF(prev), firstF(prev)) },
      { key: 'views', label: 'Visualizações', value: sum(cur.map((d) => d.views)), previous: sum(prev.map((d) => d.views)) },
      { key: 'taps', label: 'Toques no link', value: sum(cur.map((d) => d.linkTaps)), previous: sum(prev.map((d) => d.linkTaps)) },
      { key: 'posts', label: 'Posts publicados', value: posts.length, previous: prevPosts.length },
      { key: 'saved', label: 'Salvamentos', value: sum(posts.map((p) => p.saved)), previous: sum(prevPosts.map((p) => p.saved)) },
    ],
    series: cur,
    topPosts: sortBy(posts, (p) => p.follows, 'desc').slice(0, 5),
  };
}

export async function getBestTimes(): Promise<Cell[]> {
  const posts = await listPosts({ days: 120 });
  const s = await series(130);
  const followersOn = (iso: string) => {
    const day = iso.slice(0, 10);
    const hit = [...s].reverse().find((d) => d.day <= day && d.followers !== null);
    return hit?.followers ?? (isDemo() ? 400 : null);
  };
  let online: { weekday: number; hour: number; value: number }[] = [];
  if (isDemo()) {
    for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) {
      const base = h >= 7 && h <= 23 ? 40 + (h >= 18 && h <= 22 ? 80 : 0) + (h >= 11 && h <= 13 ? 35 : 0) : 8;
      online.push({ weekday: wd, hour: h, value: base - (wd === 0 || wd === 6 ? 15 : 0) });
    }
  } else {
    const sb = await supabaseUser();
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await sb.from('online_followers_hourly').select('day,hour,value').gte('day', from);
    online = (data ?? []).map((r) => ({ weekday: new Date(`${r.day}T12:00:00Z`).getUTCDay(), hour: r.hour, value: r.value }));
  }
  return bestTimes(online, posts.map((p) => ({ publishedAt: p.publishedAt, views: p.views, followersAtTime: followersOn(p.publishedAt) })));
}

export async function listCompetitors(): Promise<CompetitorRow[]> {
  if (isDemo()) return DEMO_COMPETITORS;
  const sb = await supabaseUser();
  const { data: comps } = await sb.from('competitor').select('id,username,status').order('created_at');
  if (!comps?.length) return [];
  const ids = comps.map((c) => c.id);
  const from = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
  const { data: daily } = await sb.from('competitor_daily').select('competitor_id,day,followers_count,media_count').in('competitor_id', ids).gte('day', from).order('day');
  const { data: media } = await sb.from('competitor_media').select('competitor_id,published_at,like_count,comments_count').in('competitor_id', ids)
    .gte('published_at', new Date(Date.now() - 28 * 86_400_000).toISOString());
  return comps.map((c) => {
    const d = (daily ?? []).filter((x) => x.competitor_id === c.id);
    const last = d[d.length - 1];
    const first = d[0];
    const m = (media ?? []).filter((x) => x.competitor_id === c.id);
    const inter = m.map((x) => (x.like_count ?? 0) + (x.comments_count ?? 0));
    return {
      id: c.id, username: c.username, status: c.status,
      followers: last?.followers_count ?? null,
      followersDelta30d: last && first && last.followers_count !== null && first.followers_count !== null && d.length > 1 ? last.followers_count - first.followers_count : null,
      mediaCount: last?.media_count ?? null,
      postsPerWeek: postsPerWeek(m.map((x) => x.published_at), new Date()),
      avgInteractions: inter.length ? inter.reduce((a, b) => a + b, 0) / inter.length : null,
    };
  });
}

export async function getCompetitor(id: string): Promise<CompetitorDetail | null> {
  if (isDemo()) return demoCompetitor(id);
  const row = (await listCompetitors()).find((c) => c.id === id);
  if (!row) return null;
  const sb = await supabaseUser();
  const { data: daily } = await sb.from('competitor_daily').select('day,followers_count').eq('competitor_id', id).order('day').limit(365);
  const { data: media } = await sb.from('competitor_media').select('ig_media_id,caption,permalink,published_at,like_count,comments_count,view_count')
    .eq('competitor_id', id).order('like_count', { ascending: false, nullsFirst: false }).limit(10);
  return {
    ...row,
    history: (daily ?? []).map((d) => ({ day: d.day, followers: d.followers_count })),
    topMedia: (media ?? []).map((m) => ({
      id: m.ig_media_id, caption: m.caption ?? '', permalink: m.permalink, publishedAt: m.published_at,
      likes: m.like_count, comments: m.comments_count, views: m.view_count,
    })),
  };
}
