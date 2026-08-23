import { supabaseAdmin } from '@/lib/supabase/admin';

export interface CommoditySnapshot {
  timestamp: string;
  price: number;
  change_pct: number | null;
  change_abs: number | null;
  metadata: Record<string, unknown>;
}

export interface ChartPoint {
  timestamp: string;
  price: number;
}

export interface RangeStats {
  min: number | null;
  max: number | null;
  earliestDate: string | null;
}

export interface RelatedNewsArticle {
  id: string;
  title: string;
  source: string | null;
  published_at: string;
  url: string;
  image_url: string | null;
}

export interface CommodityDetail {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  finnhub_symbol: string | null;
  eia_series_id: string | null;
  latest: CommoditySnapshot | null;
  history: ChartPoint[];
  range: RangeStats;
  relatedNews: RelatedNewsArticle[];
}

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  finnhub_symbol: string | null;
  eia_series_id: string | null;
}

function toDisplaySource(source: unknown): string {
  if (source === 'eia') return 'EIA';
  if (source === 'metals_dev') return 'Metals.dev';
  if (source === 'finnhub') return 'Finnhub';
  if (source === 'fred') return 'FRED';
  if (typeof source === 'string' && source.length > 0) {
    // Fallback: capitalise first letter
    return source.charAt(0).toUpperCase() + source.slice(1);
  }
  return '--';
}

export function getSourceLabel(metadata: Record<string, unknown> | null | undefined): string {
  const raw = metadata?.source;
  return toDisplaySource(raw);
}

/**
 * Derives the underlying data's as-of date from metadata, not the ingestion timestamp.
 * EIA -> eia_date, Metals.dev -> metals_dev_date, else null (no fabrication).
 */
export function getLastUpdatedDate(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  if (typeof metadata.eia_date === 'string' && metadata.eia_date) return metadata.eia_date;
  if (typeof metadata.metals_dev_date === 'string' && metadata.metals_dev_date) return metadata.metals_dev_date;
  // Fallbacks for other sources (honest, not fabricated)
  if (typeof metadata.fred_date === 'string' && metadata.fred_date) return metadata.fred_date;
  if (typeof metadata.finnhub_timestamp === 'string' && metadata.finnhub_timestamp) return metadata.finnhub_timestamp;
  return null;
}

export async function getCommodityDetail(symbol: string): Promise<CommodityDetail | null> {
  const upper = symbol.toUpperCase();

  const { data: asset, error: assetError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, name, asset_class, finnhub_symbol, eia_series_id')
    .eq('symbol', upper)
    .eq('asset_class', 'commodity')
    .maybeSingle();

  if (assetError) {
    throw new Error(`Failed to load commodity ${upper}: ${assetError.message}`);
  }
  if (!asset) return null;

  const typedAsset = asset as AssetRow;

  // Fetch latest first to determine the asset's CURRENT real source.
  // This drives the filtered range/caveat — pre-switch Finnhub ETF-proxy rows must NOT
  // contaminate the "Range Since Tracking Began" even though each row individually is real.
  const { data: latestData, error: latestError } = await supabaseAdmin
    .from('market_snapshots')
    .select('price, change_pct, change_abs, timestamp, metadata')
    .eq('asset_id', typedAsset.id)
    .order('timestamp', { ascending: false })
    .limit(1);

  if (latestError) throw new Error(`Failed to load latest for ${upper}: ${latestError.message}`);

  const latestRes = { data: latestData, error: null } as const;

  // Derive current source for honest range filtering (e.g. 'eia' for WTI, 'metals_dev' for GOLD).
  // If no snapshot exists yet, no filter is applied.
  const currentSource =
    (latestData?.[0]?.metadata as Record<string, unknown> | undefined)?.source as string | undefined;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Build range queries filtered to the current real source only — prevents mixing
  // old Finnhub ETF-proxy prices (e.g. USO ~$120 for WTI, CPER ~$38 for copper) with
  // real spot prices (WTI ~$86, copper ~$14k) into a single misleading range.
  function rangeQuery(
    orderBy: 'price' | 'timestamp',
    ascending: boolean,
    select: string
  ) {
    let q = supabaseAdmin
      .from('market_snapshots')
      .select(select)
      .eq('asset_id', typedAsset.id)
      .order(orderBy, { ascending });
    if (currentSource) {
      q = q.eq('metadata->>source', currentSource);
    }
    return q.limit(1);
  }

  // History must also be filtered to current real source — otherwise the 30-day
  // window (since 2026-07-24) straddles the Aug 19 switch and mixes Finnhub ETF
  // proxy prices with real spot prices at wildly different scales (WTI -35%,
  // GOLD +989%, COPPER +35809%, etc.), producing a visual cliff.
  // Filtered, honest history currently yields only ~4-5 days of real data (Aug 19→now).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let historyQuery: any = supabaseAdmin
    .from('market_snapshots')
    .select('timestamp, price')
    .eq('asset_id', typedAsset.id)
    .gte('timestamp', since30d)
    .order('timestamp', { ascending: false })
    .limit(15000);
  if (currentSource) {
    historyQuery = historyQuery.eq('metadata->>source', currentSource);
  }

  const [historyRes, maxRes, minRes, earliestRes, newsRes] = await Promise.all([
    historyQuery as Promise<{ data: { timestamp: string; price: number }[] | null; error: { message: string } | null }>,
    rangeQuery('price', false, 'price'),
    rangeQuery('price', true, 'price'),
    rangeQuery('timestamp', true, 'timestamp'),
    supabaseAdmin
      .from('news_articles')
      .select('id, title, source, published_at, url, image_url')
      .contains('matched_asset_ids', [typedAsset.id])
      .order('published_at', { ascending: false })
      .limit(10),
  ]);

  if (historyRes.error) throw new Error(`Failed to load history for ${upper}: ${(historyRes.error as { message: string }).message}`);
  if (maxRes.error) throw new Error(`Failed to load max price for ${upper}: ${maxRes.error.message}`);
  if (minRes.error) throw new Error(`Failed to load min price for ${upper}: ${minRes.error.message}`);
  if (earliestRes.error) throw new Error(`Failed to load earliest date for ${upper}: ${earliestRes.error.message}`);
  if (newsRes.error) throw new Error(`Failed to load related news for ${upper}: ${newsRes.error.message}`);

  const latestRow = (latestRes.data?.[0] as unknown as {
    price: number;
    change_pct: number | null;
    change_abs: number | null;
    timestamp: string;
    metadata: unknown;
  } | undefined) ?? null;

  const latest: CommoditySnapshot | null = latestRow
    ? {
        timestamp: latestRow.timestamp,
        price: Number(latestRow.price),
        change_pct: latestRow.change_pct,
        change_abs: latestRow.change_abs,
        metadata: (latestRow.metadata as Record<string, unknown>) ?? {},
      }
    : null;

  // History queried desc+limit to get the MOST RECENT 30d window; reverse to chronological for chart
  const rawHistory: ChartPoint[] = ((historyRes.data ?? []) as { timestamp: string; price: number }[])
    .slice()
    .reverse()
    .map((r) => ({ timestamp: r.timestamp, price: Number(r.price) }));

  const DOWNSAMPLE_TARGET = 120;
  let history = rawHistory;
  if (rawHistory.length > DOWNSAMPLE_TARGET) {
    const step = (rawHistory.length - 1) / (DOWNSAMPLE_TARGET - 1);
    const sampled: ChartPoint[] = [];
    for (let i = 0; i < DOWNSAMPLE_TARGET; i++) {
      sampled.push(rawHistory[Math.round(i * step)]);
    }
    history = sampled;
  }

  const maxPrice = ((maxRes.data as unknown as { price: number }[] | null)?.[0])?.price ?? null;
  const minPrice = ((minRes.data as unknown as { price: number }[] | null)?.[0])?.price ?? null;
  const earliestDate = ((earliestRes.data as unknown as { timestamp: string }[] | null)?.[0])?.timestamp ?? null;

  const range: RangeStats = {
    min: minPrice !== null ? Number(minPrice) : null,
    max: maxPrice !== null ? Number(maxPrice) : null,
    earliestDate,
  };

  const relatedNews: RelatedNewsArticle[] = ((newsRes.data ?? []) as RelatedNewsArticle[]).map((r) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    published_at: r.published_at,
    url: r.url,
    image_url: r.image_url,
  }));

  return {
    id: typedAsset.id,
    symbol: typedAsset.symbol,
    name: typedAsset.name,
    asset_class: typedAsset.asset_class,
    finnhub_symbol: typedAsset.finnhub_symbol,
    eia_series_id: typedAsset.eia_series_id,
    latest,
    history,
    range,
    relatedNews,
  };
}
