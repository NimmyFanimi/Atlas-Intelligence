import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatPrice, formatPercent } from '@/lib/utils/format';

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
// HISTORY_WINDOW_HOURS removed from query logic: per-asset latest is now unconditional
// ("most recent row that exists" whether 5 min or 24h old) so sparse daily assets
// (GOLD/COPPER via Metals.dev, US10Y/US2Y via FRED) are not crowded out by the
// 1000-row PostgREST cap that truncated the prior global window query. Sparkline
// likewise fetches the most recent 30 rows per asset regardless of age, matching
// getCommoditiesOverview / commodityDetail pattern.

export async function getMarketsDashboard(): Promise<MarketsDashboardData> {
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, name, asset_class, finnhub_symbol, fred_series_id, eia_series_id')
    .order('asset_class', { ascending: true })
    .order('symbol', { ascending: true });

  if (assetsError || !assets) {
    throw new Error(`Failed to load assets: ${assetsError?.message}`);
  }

  // Per-asset parallel queries — each asset independently fetches its most
  // recent SPARKLINE_POINTS rows. No asset can crowd out another via global
  // ORDER BY timestamp cap. Mirrors commodityDetail.ts / getCommoditiesOverview.
  const perAssetResults = await Promise.all(
    assets.map(async (asset) => {
      const { data, error } = await supabaseAdmin
        .from('market_snapshots')
        .select('timestamp, price, change_pct, change_abs, metadata')
        .eq('asset_id', asset.id)
        .order('timestamp', { ascending: false })
        .limit(SPARKLINE_POINTS);

      if (error) {
        throw new Error(`Failed to load snapshots for ${asset.symbol}: ${error.message}`);
      }

      // Reverse to chronological for sparkline/latest logic (oldest -> newest)
      const rows = (data ?? []).slice().reverse();
      return { assetId: asset.id, rows };
    })
  );

  const snapshotsByAsset = new Map<string, Snapshot[]>();
  for (const { assetId, rows } of perAssetResults) {
    const snaps: Snapshot[] = rows.map((r) => ({
      timestamp: r.timestamp as string,
      price: Number((r as { price: number }).price),
      change_pct: (r as { change_pct: number | null }).change_pct,
      change_abs: (r as { change_abs: number | null }).change_abs,
      metadata: ((r as { metadata: unknown }).metadata as Record<string, unknown>) || {},
    }));
    snapshotsByAsset.set(assetId, snaps);
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

export interface LandingAssetPreview {
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  changePct: number | null;
  formattedPrice: string;
  formattedChangePct: string;
  isUp: boolean;
}

export async function getLandingPreviewAssets(): Promise<LandingAssetPreview[]> {
  const targetSymbols = ['WTI', 'GOLD', 'DXY', 'US10Y'];

  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, name, asset_class')
    .in('symbol', targetSymbols);

  if (assetsError || !assets) {
    throw new Error(`Failed to load landing preview assets: ${assetsError?.message}`);
  }

  const previews = await Promise.all(
    targetSymbols.map(async (sym) => {
      const asset = assets.find((a) => a.symbol === sym);
      if (!asset) return null;

      const { data: snapshots, error: snapError } = await supabaseAdmin
        .from('market_snapshots')
        .select('price, change_pct, timestamp')
        .eq('asset_id', asset.id)
        .order('timestamp', { ascending: false })
        .limit(2);

      if (snapError) {
        throw new Error(`Failed to load snapshot for ${sym}: ${snapError.message}`);
      }

      const latest = snapshots?.[0];
      if (!latest) return null;

      const price = Number(latest.price);
      let changePct = latest.change_pct;

      // If change_pct is null (e.g. FRED daily rates), look for previous distinct snapshot or fallback
      if (changePct === null || changePct === undefined) {
        const { data: prevSnap } = await supabaseAdmin
          .from('market_snapshots')
          .select('price')
          .eq('asset_id', asset.id)
          .neq('price', price)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevSnap && prevSnap.price > 0) {
          changePct = ((price - prevSnap.price) / prevSnap.price) * 100;
        } else {
          changePct = 0;
        }
      }

      // Commodities get $, FX/rates/indices do not
      const formattedPrice =
        asset.asset_class === 'commodity'
          ? `$${formatPrice(price)}`
          : formatPrice(price);

      const formattedChangePct = formatPercent(changePct);
      const isUp = changePct >= 0;

      return {
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.asset_class,
        price,
        changePct,
        formattedPrice,
        formattedChangePct,
        isUp,
      };
    })
  );

  return previews.filter((p): p is LandingAssetPreview => p !== null);
}
