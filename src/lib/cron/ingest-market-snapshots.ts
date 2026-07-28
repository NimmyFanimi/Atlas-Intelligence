import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchQuote } from '@/lib/data-sources/finnhub';
import { fetchLatestRate } from '@/lib/data-sources/fred';

interface Asset {
  id: string;
  symbol: string;
  asset_class: string;
  finnhub_symbol: string | null;
  fred_series_id: string | null;
}

interface IngestResult {
  symbol: string;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
}

/**
 * Checks whether a FRED snapshot for the given asset already exists today (UTC).
 * Avoids redundant FRED calls on sub-daily cron runs.
 */
async function fredAlreadyFetchedToday(assetId: string): Promise<boolean> {
  const todayUtc = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const { data, error } = await supabaseAdmin
    .from('market_snapshots')
    .select('id')
    .eq('asset_id', assetId)
    .gte('timestamp', `${todayUtc}T00:00:00Z`)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "no rows found", which is expected if not yet fetched today
    throw new Error(`Failed to check existing FRED snapshot: ${error.message}`);
  }

  return data !== null;
}

/**
 * Ingests a single snapshot for each asset in the watchlist:
 * - Assets with a finnhub_symbol → hit Finnhub /quote
 * - Assets with a fred_series_id  → hit FRED (skipped if already fetched today)
 *
 * Each asset is isolated in its own try/catch — one failure does not abort the run.
 * Returns a per-asset result summary for the caller to log.
 */
export async function ingestMarketSnapshots(): Promise<IngestResult[]> {
  // 1. Load all assets from Supabase
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, asset_class, finnhub_symbol, fred_series_id');

  if (assetsError || !assets) {
    throw new Error(`Failed to load assets: ${assetsError?.message}`);
  }

  const results: IngestResult[] = [];
  const now = new Date();

  for (const asset of assets as Asset[]) {
    // ── Finnhub path ─────────────────────────────────────────────────────────
    if (asset.finnhub_symbol) {
      try {
        const quote = await fetchQuote(asset.finnhub_symbol);

        const { error: insertError } = await supabaseAdmin
          .from('market_snapshots')
          .insert({
            asset_id: asset.id,
            timestamp: now.toISOString(),
            price: quote.price,
            change_pct: quote.change_pct,
            change_abs: quote.change_abs,
            metadata: {
              prev_close: quote.prev_close,
              high: quote.high,
              low: quote.low,
              open: quote.open,
              source: 'finnhub',
              finnhub_symbol: asset.finnhub_symbol,
              finnhub_timestamp: quote.timestamp.toISOString(),
            },
          });

        if (insertError) throw new Error(insertError.message);

        results.push({ symbol: asset.symbol, status: 'ok' });
      } catch (err) {
        results.push({
          symbol: asset.symbol,
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }

      // Defensive 100ms delay between Finnhub calls to avoid burst detection
      await new Promise(r => setTimeout(r, 100));

    // ── FRED path ─────────────────────────────────────────────────────────────
    } else if (asset.fred_series_id) {
      try {
        const alreadyFetched = await fredAlreadyFetchedToday(asset.id);

        if (alreadyFetched) {
          results.push({ symbol: asset.symbol, status: 'skipped', message: 'FRED already fetched today' });
          continue;
        }

        const rate = await fetchLatestRate(asset.fred_series_id);

        const { error: insertError } = await supabaseAdmin
          .from('market_snapshots')
          .insert({
            asset_id: asset.id,
            timestamp: now.toISOString(),
            price: rate.value,
            change_pct: null, // FRED does not provide intraday change — computed later if needed
            change_abs: null,
            metadata: {
              source: 'fred',
              fred_series_id: asset.fred_series_id,
              fred_date: rate.date.toISOString(),
            },
          });

        if (insertError) throw new Error(insertError.message);

        results.push({ symbol: asset.symbol, status: 'ok' });
      } catch (err) {
        results.push({
          symbol: asset.symbol,
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }

    // ── No provider configured ────────────────────────────────────────────────
    } else {
      results.push({
        symbol: asset.symbol,
        status: 'error',
        message: 'No finnhub_symbol or fred_series_id configured',
      });
    }
  }

  return results;
}
