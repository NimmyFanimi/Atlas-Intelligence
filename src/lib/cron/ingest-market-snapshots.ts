import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchQuote } from '@/lib/data-sources/finnhub';
import { fetchLatestRate } from '@/lib/data-sources/fred';
import { fetchEIAPrice } from '@/lib/data-sources/eia';
import { fetchMetalsDevPrices } from '@/lib/data-sources/metals-dev';

interface Asset {
  id: string;
  symbol: string;
  asset_class: string;
  finnhub_symbol: string | null;
  fred_series_id: string | null;
  eia_series_id: string | null;
}

// Metals.dev key per metals-sourced commodity (no DB column — hardcoded lookup).
const METALS_DEV_METALS: Record<string, string> = {
  COPPER: 'lme_copper',
  GOLD: 'gold',
};

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
 * Computes change_abs / change_pct for sources (EIA, Metals.dev) that only
 * return an absolute price, never a change figure.
 *
 * We compare against the asset's most recent snapshot whose price DIFFERS from
 * the newly fetched price — not the literal most recent row, and not the row
 * from "yesterday". EIA-sourced assets publish weekly, so a real update can be
 * 7+ days apart; comparing to the previous calendar day would frequently
 * compare a stale price against itself and report a false 0% change. Using the
 * most recent distinct price means a weekly move shows up as the full weekly
 * change rather than being diluted across the intervening stale snapshots.
 *
 * If no prior distinct-price row exists yet (e.g. the very first real snapshot),
 * nulls are returned and callers insert change_pct: null / change_abs: null —
 * no fabricated 0% and no error.
 *
 * The distinct-price scan is scoped to the SAME `metadata.source` as the row
 * being inserted. Assets like WTI/BRENT/NATGAS/COPPER/GOLD were historically
 * priced via Finnhub ETF proxies (USO/BNO/UNG/CPER/GLD) — a completely different
 * price scale (e.g. CPER ~$39 vs COPPER spot ~$14,080). Without source scoping,
 * the "most recent distinct price" walk crosses that source boundary and compares
 * a spot price against an ETF share price, producing absurd change values
 * (e.g. +35608% on copper). Comparing within one source keeps change on a single
 * price scale and lets the EIA weekly-lag logic above work as intended.
 */
async function computeAbsPriceChange(
  assetId: string,
  newPrice: number,
  source: 'eia' | 'metals_dev'
): Promise<{ change_abs: number | null; change_pct: number | null }> {
  const { data, error } = await supabaseAdmin
    .from('market_snapshots')
    .select('price')
    .eq('asset_id', assetId)
    .eq('metadata->>source', source)
    .neq('price', newPrice)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load previous distinct price for ${assetId}: ${error.message}`);
  }

  if (!data) {
    return { change_abs: null, change_pct: null };
  }

  const changeAbs = newPrice - data.price;
  const changePct = (changeAbs / data.price) * 100;
  return { change_abs: changeAbs, change_pct: changePct };
}

/**
 * Ingests a single snapshot for each asset in the watchlist:
 * - COPPER / GOLD             → hit Metals.dev /latest (real spot prices)
 * - Assets with an eia_series_id → hit EIA v2 (real commodity spot prices)
 * - Assets with a finnhub_symbol → hit Finnhub /quote
 * - Assets with a fred_series_id  → hit FRED (skipped if already fetched today)
 *
 * EIA is checked before Finnhub so commodities with both an eia_series_id and a
 * finnhub_symbol (e.g. WTI, BRENT, NATGAS) use EIA's real spot prices instead of
 * the Finnhub ETF proxies. COPPER and GOLD are likewise priced via Metals.dev
 * instead of their CPER/GLD ETF proxies, and both share a SINGLE /latest call per
 * run since the endpoint returns all metals in one payload.
 *
 * Each asset is isolated in its own try/catch — one failure does not abort the run.
 * Returns a per-asset result summary for the caller to log.
 */
export async function ingestMarketSnapshots(): Promise<IngestResult[]> {
  // 1. Load all assets from Supabase
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, asset_class, finnhub_symbol, fred_series_id, eia_series_id');

  if (assetsError || !assets) {
    throw new Error(`Failed to load assets: ${assetsError?.message}`);
  }

  const results: IngestResult[] = [];
  const now = new Date();

  // 2. Single Metals.dev call for every metals-sourced asset in this run
  const metalsNeeded = Array.from(
    new Set(
      (assets as Asset[])
        .filter(asset => METALS_DEV_METALS[asset.symbol])
        .map(asset => METALS_DEV_METALS[asset.symbol])
    )
  );

  let metalsQuotes: Record<string, { value: number; date: Date }> = {};
  let metalsError: string | null = null;

  if (metalsNeeded.length > 0) {
    try {
      metalsQuotes = await fetchMetalsDevPrices(metalsNeeded);
    } catch (err) {
      metalsError = err instanceof Error ? err.message : String(err);
    }

    // Defensive 100ms delay after the external API call to avoid burst detection
    await new Promise(r => setTimeout(r, 100));
  }

  for (const asset of assets as Asset[]) {
    // ── Metals.dev path (COPPER, GOLD) ───────────────────────────────────────
    if (METALS_DEV_METALS[asset.symbol]) {
      const metal = METALS_DEV_METALS[asset.symbol];
      try {
        const quote = metalsQuotes[metal];

        // Shared-call failure report is isolated per asset; a missing metal in
        // the response (e.g. gold present but lme_copper absent) likewise only
        // fails that one asset, never the other.
        if (!quote && metalsError) throw new Error(metalsError);
        if (!quote) throw new Error(`Metals.dev [${metal}] returned no price in shared response`);

        const { change_abs, change_pct } = await computeAbsPriceChange(asset.id, quote.value, 'metals_dev');

        const { error: insertError } = await supabaseAdmin
          .from('market_snapshots')
          .insert({
            asset_id: asset.id,
            timestamp: now.toISOString(),
            price: quote.value,
            change_pct, // Metals.dev daily price — change vs most recent distinct price
            change_abs,
            metadata: {
              source: 'metals_dev',
              metal,
              metals_dev_date: quote.date.toISOString(),
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

    // ── EIA path ─────────────────────────────────────────────────────────────
    } else if (asset.eia_series_id) {
      try {
        const spot = await fetchEIAPrice(asset.eia_series_id);

        const { change_abs, change_pct } = await computeAbsPriceChange(asset.id, spot.value, 'eia');

        const { error: insertError } = await supabaseAdmin
          .from('market_snapshots')
          .insert({
            asset_id: asset.id,
            timestamp: now.toISOString(),
            price: spot.value,
            change_pct, // EIA weekly spot price — change vs most recent distinct price
            change_abs,
            metadata: {
              source: 'eia',
              eia_series_id: asset.eia_series_id,
              eia_date: spot.date.toISOString(),
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

      // Defensive 100ms delay between external API calls to avoid burst detection
      await new Promise(r => setTimeout(r, 100));

    // ── Finnhub path ─────────────────────────────────────────────────────────
    } else if (asset.finnhub_symbol) {
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
        message: 'No finnhub_symbol, eia_series_id, or fred_series_id configured',
      });
    }
  }

  return results;
}
