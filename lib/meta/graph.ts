import 'server-only';

// Cliente mínimo da Instagram Graph API (login via Facebook). Só endpoints oficiais e públicos.

const VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const BASE = `https://graph.facebook.com/${VERSION}`;

export class GraphError extends Error {
  constructor(message: string, public status: number, public code?: number) {
    super(message);
  }
}

export interface CallInfo { endpoint: string; status: number; usagePct: number | null }

/** Lê o maior percentual de uso dos cabeçalhos de limite da Meta. */
export function usageFromHeaders(h: Headers): number | null {
  let max: number | null = null;
  for (const name of ['x-business-use-case-usage', 'x-app-usage']) {
    const raw = h.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const buckets: Record<string, number>[] = Array.isArray(parsed)
        ? parsed
        : name === 'x-app-usage'
          ? [parsed]
          : Object.values(parsed).flat() as Record<string, number>[];
      for (const b of buckets) {
        for (const k of ['call_count', 'total_cputime', 'total_time']) {
          const v = Number(b[k]);
          if (Number.isFinite(v)) max = Math.max(max ?? 0, v);
        }
      }
    } catch {
      /* cabeçalho malformado: ignora */
    }
  }
  return max;
}

export async function graph<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
  init: { method?: 'GET' | 'POST'; onCall?: (c: CallInfo) => void } = {},
): Promise<T> {
  const url = new URL(`${BASE}/${path.replace(/^\//, '')}`);
  const body = new URLSearchParams(token ? { ...params, access_token: token } : params);
  const method = init.method ?? 'GET';
  if (method === 'GET') url.search = body.toString();
  const res = await fetch(url, {
    method,
    body: method === 'POST' ? body : undefined,
    cache: 'no-store',
  });
  init.onCall?.({ endpoint: path.split('?')[0], status: res.status, usagePct: usageFromHeaders(res.headers) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new GraphError(json?.error?.message ?? `Erro ${res.status} na API da Meta`, res.status, json?.error?.code);
  }
  return json as T;
}

/** Percorre páginas (cursor) até `max` itens. */
export async function graphAll<T>(path: string, token: string, params: Record<string, string>, max = 500, onCall?: (c: CallInfo) => void): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  while (out.length < max) {
    const page: { data: T[]; paging?: { cursors?: { after?: string }; next?: string } } =
      await graph(path, token, { ...params, limit: '50', ...(after ? { after } : {}) }, { onCall });
    out.push(...page.data);
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out.slice(0, max);
}

// ---------- Endpoints usados ----------

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD';
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count';

export function mediaInsightMetrics(m: IgMedia): string {
  if (m.media_product_type === 'STORY') return 'views,reach,shares,follows,total_interactions';
  if (m.media_product_type === 'REELS') return 'views,reach,saved,shares,total_interactions,ig_reels_avg_watch_time';
  return 'views,reach,saved,shares,follows,total_interactions';
}

export interface InsightValue { name: string; values?: { value: number }[]; total_value?: { value: number } }

export function insightMap(data: InsightValue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of data) {
    const v = d.total_value?.value ?? d.values?.[0]?.value;
    if (typeof v === 'number') out[d.name] = v;
  }
  return out;
}

export interface BusinessDiscovery {
  business_discovery: {
    username: string;
    name?: string;
    followers_count?: number;
    media_count?: number;
    media?: { data: { id: string; caption?: string; media_type?: string; permalink?: string; timestamp: string; like_count?: number; comments_count?: number; view_count?: number }[] };
  };
}

export function businessDiscovery(igUserId: string, username: string, token: string, onCall?: (c: CallInfo) => void) {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(clean)) throw new GraphError('Nome de usuário inválido', 400);
  const fields = `business_discovery.username(${clean}){username,name,followers_count,media_count,media.limit(25){id,caption,media_type,permalink,timestamp,like_count,comments_count,view_count}}`;
  return graph<BusinessDiscovery>(igUserId, token, { fields }, { onCall });
}
