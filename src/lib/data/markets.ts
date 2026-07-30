import { supabaseAdmin } from '@/lib/supabase/admin';

export interface Snapshot {
  timestamp: string;
  price: number;
  change_pct: number | null;
  change_abs: number | null;
  metadata: Record<string, unknown>;
}

export interface AssetWithSnapshot {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  finnhub_symbol: string | null;
  fred_series_id: string | null;
  eia_series_id: string | null;
  latest: Snapshot | null;
  sparkline: { timestamp: string; price: number }[];
}

export interface MostVolatileAsset {
  asset: AssetWithSnapshot;
  volatility: number;
}

export interface MarketsSummary {
  biggestMover: AssetWithSnapshot | null;
  mostVolatile: MostVolatileAsset | null;
  breadth: { up: number; down: number; flat: number };
  totalAssets: { total: number; breakdown: Record<string, number> };
}

export interface MarketsDashboardData {
  assets: AssetWithSnapshot[];
  grouped: Record<string, AssetWithSnapshot[]>;
  defaultSelectedId: string | null;
  summary: MarketsSummary;
}

const SPARKLINE_POINTS = 30;
const HISTORY_WINDOW_HOURS = 48;

export async function getMarketsDashboard(): Promise<MarketsDashboardData> {
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, name, asset_class, finnhub_symbol, fred_series_id, eia_series_id')
    .order('asset_class', { ascending: true })
    .order('symbol', { ascending: true });

  if (assetsError || !assets) {
    throw new Error(`Failed to load assets: ${assetsError?.message}`);
  }

  const assetIds = assets.map((a) => a.id);

  const since = new Date(
    Date.now() - HISTORY_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: snapshots, error: snapshotsError } = await supabaseAdmin
    .from('market_snapshots')
    .select('asset_id, timestamp, price, change_pct, change_abs, metadata')
    .in('asset_id', assetIds)
    .gte('timestamp', since)
    .order('timestamp', { ascending: true });

  if (snapshotsError) {
    throw new Error(`Failed to load snapshots: ${snapshotsError.message}`);
  }

  const snapshotsByAsset = new Map<string, Snapshot[]>();
  for (const snap of snapshots || []) {
    const existing = snapshotsByAsset.get(snap.asset_id) || [];
    existing.push({
      timestamp: snap.timestamp,
      price: Number(snap.price),
      change_pct: snap.change_pct,
      change_abs: snap.change_abs,
      metadata: (snap.metadata as Record<string, unknown>) || {},
    });
    snapshotsByAsset.set(snap.asset_id, existing);
  }

  const assetsWithData: AssetWithSnapshot[] = assets.map((asset) => {
    const snaps = snapshotsByAsset.get(asset.id) || [];
    const latest = snaps.length > 0 ? snaps[snaps.length - 1] : null;
    const sparkline = snaps.slice(-SPARKLINE_POINTS).map((s) => ({
      timestamp: s.timestamp,
      price: s.price,
    }));
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      asset_class: asset.asset_class,
      finnhub_symbol: asset.finnhub_symbol,
      fred_series_id: asset.fred_series_id,
      eia_series_id: asset.eia_series_id,
      latest,
      sparkline,
    };
  });

  const grouped = assetsWithData.reduce(
    (acc, asset) => {
      const key = asset.asset_class;
      if (!acc[key]) acc[key] = [];
      acc[key].push(asset);
      return acc;
    },
    {} as Record<string, AssetWithSnapshot[]>
  );

  const defaultSelectedId =
    assetsWithData.find((a) => a.asset_class === 'index')?.id ||
    assetsWithData[0]?.id ||
    null;

  let biggestMover: AssetWithSnapshot | null = null;
  let biggestMoverAbs = -1;
  for (const asset of assetsWithData) {
    const pct = asset.latest?.change_pct;
    if (pct !== null && pct !== undefined && !isNaN(pct)) {
      const abs = Math.abs(pct);
      if (abs > biggestMoverAbs) {
        biggestMoverAbs = abs;
        biggestMover = asset;
      }
    }
  }

  let up = 0;
  let down = 0;
  let flat = 0;
  for (const asset of assetsWithData) {
    const pct = asset.latest?.change_pct;
    if (pct === null || pct === undefined || isNaN(pct) || pct === 0) {
      flat++;
    } else if (pct > 0) {
      up++;
    } else {
      down++;
    }
  }

  const breakdown: Record<string, number> = {};
  for (const asset of assetsWithData) {
    breakdown[asset.asset_class] = (breakdown[asset.asset_class] || 0) + 1;
  }

  let mostVolatile: MostVolatileAsset | null = null;
  let maxVolatility = -1;
  for (const asset of assetsWithData) {
    if (asset.sparkline.length < 3) continue;
    const prices = asset.sparkline.map((p) => p.price);
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    if (avg === 0) continue;
    const volatility = (max - min) / avg * 100;
    if (volatility > maxVolatility) {
      maxVolatility = volatility;
      mostVolatile = { asset, volatility };
    }
  }

  const summary: MarketsSummary = {
    biggestMover,
    mostVolatile,
    breadth: { up, down, flat },
    totalAssets: { total: assetsWithData.length, breakdown },
  };

  return { assets: assetsWithData, grouped, defaultSelectedId, summary };
}
