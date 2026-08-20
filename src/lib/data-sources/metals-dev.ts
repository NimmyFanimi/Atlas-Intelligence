// Metals.dev /v1/latest response shape
interface MetalsDevResponse {
  status: string;
  currency: string;
  unit: string;
  metals: Record<string, number>;
  timestamps: {
    metal: string;    // 'YYYY-MM-DD'
    currency: string; // 'YYYY-MM-DD'
  };
}

export interface MetalsDevResult {
  value: number; // Price of the requested metal (e.g. ~14315 for lme_copper, USD/mt)
  date: Date;    // Date the price was published
}

/**
 * Fetches the latest prices for one or more metals in a single /v1/latest call.
 *
 * The endpoint returns the full metals object in one payload even when a subset
 * is requested, so batching multiple metals (e.g. gold + lme_copper) uses one
 * API request per run instead of one per metal.
 *
 * Returns only the requested metals that were present and numeric in the
 * response; a requested metal that is missing or non-numeric is omitted from the
 * map rather than failing the whole call, so callers can report per-metal errors.
 */
export async function fetchMetalsDevPrices(metals: string[]): Promise<Record<string, MetalsDevResult>> {
  const apiKey = process.env.METALS_DEV_API_KEY;
  if (!apiKey) throw new Error('METALS_DEV_API_KEY is not set');

  const unique = Array.from(new Set(metals.filter(m => m)));
  if (unique.length === 0) return {};

  const url = `https://api.metals.dev/v1/latest?api_key=${apiKey}&base=USD&metals=${encodeURIComponent(unique.join(','))}`;

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Metals.dev /latest [${unique.join(',')}] failed: HTTP ${res.status}`);
  }

  const data: MetalsDevResponse = await res.json();

  const results: Record<string, MetalsDevResult> = {};
  for (const metal of unique) {
    const value = data.metals?.[metal];

    if (typeof value !== 'number' || Number.isNaN(value)) {
      continue; // Omit missing metals so the caller can handle them per-asset
    }

    results[metal] = {
      value,
      date: new Date(data.timestamps.metal),
    };
  }

  return results;
}