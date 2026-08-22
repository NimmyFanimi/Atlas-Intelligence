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
  const primaryKey = process.env.METALS_DEV_API_KEY;
  if (!primaryKey) throw new Error('METALS_DEV_API_KEY is not set');
  const fallbackKey = process.env.METALS_DEV_API_KEY_FALLBACK;

  const unique = Array.from(new Set(metals.filter(m => m)));
  if (unique.length === 0) return {};

  // Metals.dev /v1/latest only documents `currency` and `unit` as query params;
  // there is no `metals` filter — it returns ALL metals every time. Previous
  // `base` + `metals` params were undocumented and cause HTTP 400.
  const buildUrl = (key: string) => `https://api.metals.dev/v1/latest?api_key=${key}&currency=USD`;

  function isQuotaExhaustionBody(body: string): boolean {
    // Observed quota-exhausted shape: {"error":"Your plan quota for the month is exhausted","error_code":1203}
    return body.includes('1203') || body.toLowerCase().includes('quota for the month is exhausted');
  }

  let res = await fetch(buildUrl(primaryKey), { cache: 'no-store' });

  if (!res.ok) {
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch {}
    const detail = bodyText ? `: ${bodyText.slice(0, 500)}` : '';
    const isQuota = isQuotaExhaustionBody(bodyText);

    if (isQuota) {
      if (fallbackKey) {
        console.log(`[Metals.dev] Primary key quota exhausted (HTTP ${res.status}), retrying with fallback key`);
        const fallbackRes = await fetch(buildUrl(fallbackKey), { cache: 'no-store' });
        if (!fallbackRes.ok) {
          let fallbackBody = '';
          try {
            fallbackBody = await fallbackRes.text();
          } catch {}
          const fallbackDetail = fallbackBody ? `: ${fallbackBody.slice(0, 500)}` : '';
          throw new Error(
            `Metals.dev /latest [${unique.join(',')}] failed: HTTP ${fallbackRes.status}${fallbackDetail} (fallback also failed; primary was quota-exhausted: HTTP ${res.status}${detail})`
          );
        }
        // Fallback succeeded — use its response for parsing below
        res = fallbackRes;
      } else {
        console.log(`[Metals.dev] Primary key quota exhausted (HTTP ${res.status}) but METALS_DEV_API_KEY_FALLBACK is not set — cannot retry`);
        throw new Error(`Metals.dev /latest [${unique.join(',')}] failed: HTTP ${res.status}${detail}`);
      }
    } else {
      // Non-quota failure — do not fall back, surface the real error so bugs aren't masked
      throw new Error(`Metals.dev /latest [${unique.join(',')}] failed: HTTP ${res.status}${detail}`);
    }
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