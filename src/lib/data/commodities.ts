// lib/data/commodities.ts
//
// Data access for the Commodities overview grid (Chunk 1 of the Commodities
// module). Mirrors the markets.ts pattern: fetch the watchlist assets first,
// then pull per-asset market_snapshots for the latest quote and a 30-point
// sparkline. One query pair per commodity is fine at this size (5 assets).

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface CommoditySnapshot {
  timestamp: string;
  price: number;
  change_pct: number | null;
  change_abs: number | null;
  metadata: Record<string, unknown>;
}

export interface CommodityOverview {
  id: string;
  symbol: string;
  name: string;
  finnhub_symbol: string | null;
  latest: CommoditySnapshot | null;
  sparkline: { price: number; timestamp: string }[];
}

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  finnhub_symbol: string | null;
}

interface LatestSnapshotRow {
  timestamp: string;
  price: number;
  change_pct: number | null;
  change_abs: number | null;
  metadata: unknown;
}

interface SparklineRow {
  timestamp: string;
  price: number;
}

const SPARKLINE_POINTS = 30;

export async function getCommoditiesOverview(): Promise<CommodityOverview[]> {
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, name, asset_class, finnhub_symbol')
    .eq('asset_class', 'commodity')
    .order('symbol', { ascending: true });

  if (assetsError || !assets) {
    throw new Error(`Failed to load commodities: ${assetsError?.message}`);
  }

  if (assets.length === 0) {
    return [];
  }

  const results = await Promise.all(
    (assets as AssetRow[]).map(async (asset) => {
      const [latestRes, sparklineRes] = await Promise.all([
        supabaseAdmin
          .from('market_snapshots')
          .select('price, change_pct, change_abs, timestamp, metadata')
          .eq('asset_id', asset.id)
          .order('timestamp', { ascending: false })
          .limit(1),
        supabaseAdmin
          .from('market_snapshots')
          .select('price, timestamp')
          .eq('asset_id', asset.id)
          .order('timestamp', { ascending: false })
          .limit(SPARKLINE_POINTS),
      ]);

      if (latestRes.error) {
        throw new Error(`Failed to load latest snapshot for ${asset.symbol}: ${latestRes.error.message}`);
      }
      if (sparklineRes.error) {
        throw new Error(`Failed to load sparkline for ${asset.symbol}: ${sparklineRes.error.message}`);
      }

      const latestRow = (latestRes.data?.[0] as LatestSnapshotRow | undefined) ?? null;
      const latest: CommoditySnapshot | null = latestRow
        ? {
            timestamp: latestRow.timestamp,
            price: Number(latestRow.price),
            change_pct: latestRow.change_pct,
            change_abs: latestRow.change_abs,
            metadata: (latestRow.metadata as Record<string, unknown>) || {},
          }
        : null;

      // Sparkline is returned oldest -> newest (left -> right on the card).
      const sparkline = ((sparklineRes.data ?? []) as SparklineRow[])
        .slice()
        .reverse()
        .map((s) => ({ price: Number(s.price), timestamp: s.timestamp }));

      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        finnhub_symbol: asset.finnhub_symbol,
        latest,
        sparkline,
      };
    })
  );

  return results;
}