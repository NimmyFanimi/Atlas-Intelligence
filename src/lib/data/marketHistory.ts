import { supabase } from '@/lib/supabase/client';

export type ChartPoint = { timestamp: string; price: number };

export interface TimeframeConfig {
  key: string;
  label: string;
  hours: number;
  limit: number;
  downsampleTarget: number | null;
}

export const TIMEFRAMES: TimeframeConfig[] = [
  { key: '1H', label: '1H', hours: 1, limit: 100, downsampleTarget: null },
  { key: '12H', label: '12H', hours: 12, limit: 500, downsampleTarget: null },
  { key: '1D', label: '1D', hours: 24, limit: 1000, downsampleTarget: null },
  { key: '7D', label: '7D', hours: 168, limit: 4000, downsampleTarget: 120 },
  { key: '30D', label: '30D', hours: 720, limit: 15000, downsampleTarget: 120 },
];

function evenlySample(rows: ChartPoint[], target: number): ChartPoint[] {
  if (rows.length <= target) return rows;
  const step = (rows.length - 1) / (target - 1);
  const sampled: ChartPoint[] = [];
  for (let i = 0; i < target; i++) {
    sampled.push(rows[Math.round(i * step)]);
  }
  return sampled;
}

export async function fetchMarketHistory(
  assetId: string,
  timeframeKey: string
): Promise<ChartPoint[]> {
  const timeframe = TIMEFRAMES.find((tf) => tf.key === timeframeKey);
  if (!timeframe) {
    throw new Error(`Unknown timeframe: ${timeframeKey}`);
  }

  const since = new Date(Date.now() - timeframe.hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('market_snapshots')
    .select('timestamp, price')
    .eq('asset_id', assetId)
    .gte('timestamp', since)
    .order('timestamp', { ascending: false })
    .limit(timeframe.limit);

  if (error) {
    throw new Error(`Failed to load market history: ${error.message}`);
  }

  const rows: ChartPoint[] = (data ?? [])
    .reverse()
    .map((row) => ({ timestamp: row.timestamp, price: Number(row.price) }));

  if (timeframe.downsampleTarget !== null && rows.length > timeframe.downsampleTarget) {
    return evenlySample(rows, timeframe.downsampleTarget);
  }

  return rows;
}
