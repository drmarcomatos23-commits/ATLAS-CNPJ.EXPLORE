// Dados de demonstração: visualizações tiradas do grid real do @matos_advogado (22/10/2026).
// Seguidores ganhos, salvamentos, compartilhamentos e alcance são SIMULADOS — só para ver o app funcionando.
import type { AccountInfo, CompetitorDetail, CompetitorRow, DailyPoint, MediaType, Pillar, PostRow, Snapshot } from '../types';

type Seed = [string, MediaType, number, Pillar];
const SEEDS: Seed[] = [
  ['STF vai decidir: holding patrimonial paga ITBI na integralização de imóveis?', 'CAROUSEL_ALBUM', 16100, 'holding'],
  ['Simples Nacional 2027: setembro tem 2 decisões importantes para as empresas', 'CAROUSEL_ALBUM', 14100, 'empresas'],
  ['ITBI e holdings: STF tem 5 votos pela imunidade, julgamento ainda não terminou', 'CAROUSEL_ALBUM', 8953, 'holding'],
  ['Reel falado no carro (de óculos)', 'REELS', 8391, 'empresas'],
  ['Reel falado: "Receita"', 'REELS', 7827, 'empresas'],
  ['Eu não costumo salvar vídeos motivacionais. Esse eu salvei.', 'REELS', 6774, 'pessoal'],
  ['Empresa do Simples Nacional: sua tributação pode mudar em 2027', 'CAROUSEL_ALBUM', 6085, 'empresas'],
  ['NFS-e Nacional: regra muda em novembro para ME e EPP', 'CAROUSEL_ALBUM', 6001, 'empresas'],
  ['Novas regras do Pix: o que muda para você em 2026', 'CAROUSEL_ALBUM', 5408, 'empresas'],
  ['Inventário: a regra mudou. É preciso pagar o ITCMD antes?', 'REELS', 3511, 'sucessao'],
  ['Por que você confia tanto que vai dar certo?', 'REELS', 3120, 'pessoal'],
  ['Decisão liminar: IBS e CBS fora da base do ICMS', 'CAROUSEL_ALBUM', 2630, 'empresas'],
  ['Eu lendo a escritura e vendo que o comprador dispensou todas as certidões', 'REELS', 2628, 'humor'],
  ['"Dr., mas é causa ganha, né?"', 'REELS', 2501, 'humor'],
  ['A vida: posso sonegar até quanto de imposto?', 'REELS', 2234, 'humor'],
  ['"Ah, mas fulano está contra você!"', 'REELS', 2188, 'humor'],
  ['O prazo do Simples acabou. E o pedido negado?', 'CAROUSEL_ALBUM', 2053, 'empresas'],
  ['Tem só 1% da empresa? Pode exigir ver as contas?', 'REELS', 1583, 'socios'],
  ['Pai pode vender um imóvel para apenas um filho?', 'REELS', 1313, 'sucessao'],
  ['Herdar quotas significa assumir a empresa?', 'CAROUSEL_ALBUM', 970, 'sucessao'],
  ['Dívida ativa da União? Entenda o Edital PGFN 6/2026', 'CAROUSEL_ALBUM', 809, 'empresas'],
  ['Benefício fiscal sob risco? A Receita mudou as regras', 'CAROUSEL_ALBUM', 678, 'empresas'],
  ['Seu sócio quer sair? Quanto você terá que pagar?', 'REELS', 487, 'socios'],
  ['Seus pais deixaram dívidas. Você precisa pagar?', 'REELS', 487, 'sucessao'],
  ['POV: o cliente quer abrir uma holding só para não pagar imposto', 'REELS', 343, 'holding'],
  ['Doou a holding aos filhos? Perdeu o controle?', 'REELS', 332, 'holding'],
  ['Prazer, sou Marco Matos', 'IMAGE', 263, 'autoridade'],
  ['Divórcio: ex-cônjuge pode entrar na empresa?', 'REELS', 165, 'socios'],
  ['Holding pode pagar despesas pessoais?', 'REELS', 139, 'holding'],
  ['Imóvel herdado: quem mora sozinho paga aluguel?', 'REELS', 128, 'sucessao'],
  ['Reforma Tributária pode mudar o preço dos carros', 'CAROUSEL_ALBUM', 114, 'empresas'],
  ['Herança digital: sua família consegue acessar seu patrimônio digital?', 'CAROUSEL_ALBUM', 95, 'sucessao'],
  ['Empresa com dívida pode distribuir lucros?', 'REELS', 95, 'empresas'],
];

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const NOW = new Date('2026-10-22T15:00:00Z').getTime();
const HOURS = [11, 12, 15, 17, 21, 22, 23]; // UTC (8h–20h em Brasília)

export const DEMO_POSTS: PostRow[] = SEEDS.map(([caption, mediaType, views, pillar], i) => {
  const r = rand(i + 7);
  const talking = mediaType === 'REELS';
  const followRate = talking ? 0.004 + r() * 0.006 : 0.0015 + r() * 0.003;
  const day = Math.floor(r() * 60);
  const d = new Date(NOW - day * 86_400_000);
  d.setUTCHours(HOURS[Math.floor(r() * HOURS.length)], 0, 0, 0);
  return {
    id: `demo-${i + 1}`,
    mediaType,
    caption,
    permalink: null,
    thumbnailUrl: null,
    publishedAt: d.toISOString(),
    pillar,
    views,
    reach: Math.round(views * (0.62 + r() * 0.2)),
    likes: Math.round(views * (0.02 + r() * 0.03)),
    comments: Math.round(views * (0.001 + r() * 0.003)),
    saved: Math.round(views * (mediaType === 'CAROUSEL_ALBUM' ? 0.012 + r() * 0.02 : 0.004 + r() * 0.01)),
    shares: Math.round(views * (0.004 + r() * 0.012)),
    follows: mediaType === 'IMAGE' ? 6 : Math.max(0, Math.round(views * followRate)),
  };
});

export const DEMO_ACCOUNT: AccountInfo = {
  username: 'matos_advogado',
  accountType: 'business',
  followers: 408,
  lastSyncedAt: new Date(NOW - 40 * 60_000).toISOString(),
  tokenExpiresAt: null,
};

export function demoSeries(days: number): DailyPoint[] {
  const r = rand(99);
  const out: DailyPoint[] = [];
  let followers = 408 - days * 3;
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(NOW - i * 86_400_000).toISOString().slice(0, 10);
    const views = Math.round(900 + r() * 1800 + (i % 7 === 2 ? 4000 : 0));
    followers += Math.round(1 + r() * 5);
    out.push({ day, followers: Math.min(followers, 408), views, reach: Math.round(views * 0.7), linkTaps: Math.round(r() * 6) });
  }
  return out;
}

export function demoSnapshots(post: PostRow): Snapshot[] {
  const start = new Date(post.publishedAt).getTime();
  const pts: Snapshot[] = [];
  for (let h = 1; h <= 72; h += h < 12 ? 1 : 6) {
    const f = 1 - Math.exp(-h / 14);
    const s = (v: number | null) => (v === null ? null : Math.round(v * f));
    pts.push({
      capturedAt: new Date(start + h * 3_600_000).toISOString(),
      views: s(post.views), reach: s(post.reach), likes: s(post.likes), comments: s(post.comments),
      saved: s(post.saved), shares: s(post.shares), follows: s(post.follows),
    });
  }
  return pts;
}

/** Concorrentes fictícios (nomes de exemplo — não são perfis reais). */
const COMP: [string, number, number, number, number][] = [
  ['exemplo_tributario', 12850, 340, 3.5, 410],
  ['exemplo_holding', 5320, 120, 4.25, 165],
  ['exemplo_sucessao', 2210, 58, 2.0, 74],
];

export const DEMO_COMPETITORS: CompetitorRow[] = COMP.map(([username, followers, delta, ppw, avg], i) => ({
  id: `comp-${i + 1}`,
  username,
  status: 'active',
  followers,
  followersDelta30d: delta,
  mediaCount: 300 + i * 90,
  postsPerWeek: ppw,
  avgInteractions: avg,
}));

export function demoCompetitor(id: string): CompetitorDetail | null {
  const base = DEMO_COMPETITORS.find((c) => c.id === id);
  if (!base) return null;
  const r = rand(base.username.length * 31);
  const history = Array.from({ length: 30 }, (_, k) => ({
    day: new Date(NOW - (29 - k) * 86_400_000).toISOString().slice(0, 10),
    followers: Math.round((base.followers ?? 0) - (base.followersDelta30d ?? 0) * (1 - k / 29)),
  }));
  const topics = ['Holding familiar: 5 erros', 'ITCMD 2026: o que mudou', 'Reforma tributária no Simples', 'Planejamento sucessório na prática', 'Doação com reserva de usufruto', 'Quotas e herdeiros'];
  const topMedia = topics.map((t, k) => ({
    id: `${id}-m${k}`,
    caption: t,
    permalink: null,
    publishedAt: new Date(NOW - (k * 4 + 1) * 86_400_000).toISOString(),
    likes: Math.round((base.avgInteractions ?? 0) * (0.6 + r())),
    comments: Math.round(5 + r() * 30),
    views: Math.round((base.followers ?? 0) * (0.3 + r() * 1.5)),
  }));
  return { ...base, history, topMedia };
}
