export type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS' | 'STORY';
export type Pillar = 'holding' | 'sucessao' | 'empresas' | 'socios' | 'autoridade' | 'humor' | 'pessoal';

export const PILLARS: { value: Pillar; label: string }[] = [
  { value: 'holding', label: 'Holding' },
  { value: 'sucessao', label: 'Sucessão' },
  { value: 'empresas', label: 'Empresas' },
  { value: 'socios', label: 'Sócios' },
  { value: 'autoridade', label: 'Autoridade' },
  { value: 'humor', label: 'Humor' },
  { value: 'pessoal', label: 'Pessoal' },
];

export const MEDIA_LABEL: Record<MediaType, string> = {
  IMAGE: 'Imagem',
  VIDEO: 'Vídeo',
  CAROUSEL_ALBUM: 'Carrossel',
  REELS: 'Reel',
  STORY: 'Story',
};

export interface Metrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  follows: number | null;
}

export interface PostRow extends Metrics {
  id: string;
  mediaType: MediaType;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string; // ISO UTC
  pillar: Pillar | null;
}

export interface Snapshot extends Metrics {
  capturedAt: string;
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  followers: number | null;
  views: number | null;
  reach: number | null;
  linkTaps: number | null;
}

export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  previous: number | null;
}

export interface Overview {
  kpis: Kpi[];
  series: DailyPoint[];
  topPosts: PostRow[];
}

export interface CompetitorRow {
  id: string;
  username: string;
  status: 'active' | 'not_supported' | 'paused';
  followers: number | null;
  followersDelta30d: number | null;
  mediaCount: number | null;
  postsPerWeek: number | null;
  avgInteractions: number | null;
}

export interface CompetitorDetail extends CompetitorRow {
  history: { day: string; followers: number | null }[];
  topMedia: {
    id: string;
    caption: string;
    permalink: string | null;
    publishedAt: string;
    likes: number | null;
    comments: number | null;
    views: number | null;
  }[];
}

export interface AccountInfo {
  username: string;
  accountType: 'business' | 'creator';
  followers: number | null;
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
}

export type SortKey = 'publishedAt' | 'views' | 'reach' | 'saved' | 'shares' | 'follows' | 'conversion';
