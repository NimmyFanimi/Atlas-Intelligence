// lib/marketaux.ts
//
// Fetches news from Marketaux and maps each article onto Atlas Intelligence's
// 16-asset watchlist via entity-symbol matching, plus an independent
// macro-keyword check for broad market relevance.
//
// Design notes (see PROJECT_CONTEXT.md for full rationale):
// - matched_asset_ids and is_macro are NOT mutually exclusive. An article
//   can be tagged to specific assets AND be flagged as macro-relevant.
// - Rate assets (FRED-sourced) will not get direct entity matches, since
//   Marketaux tags real tickers, not FRED series IDs. They only surface
//   via is_macro. This is expected, not a bug.
// - Articles that match neither an asset nor a macro keyword are still
//   stored (matched_asset_ids = [], is_macro = false). They just won't
//   render in either UI section. This keeps ingestion logic simple and
//   makes debugging easier later (you can inspect what got hidden).

interface MarketauxEntity {
  symbol: string;
  name: string;
  type: string;
  match_score: number;
  sentiment_score: number | null; // confirmed via real API response: sentiment lives
    // per-entity, NOT at the article level. There is no top-level "sentiment" field.
}

interface MarketauxArticle {
  uuid: string;
  title: string;
  description: string;
  keywords?: string; // comma-separated, useful supplementary signal for macro check
  url: string;
  image_url?: string | null; // present on some articles, absent on others
  source: string;
  published_at: string;
  entities: MarketauxEntity[];
}

interface MarketauxResponse {
  data: MarketauxArticle[];
}

export interface RawNewsArticle {
  marketauxUuid: string;
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  source: string | null;
  publishedAt: string;
  sentimentScore: number | null;
  matchedAssetIds: string[];
  isMacro: boolean;
}

// Keyword list for macro relevance. Deliberately simple and transparent,
// not a perfect classifier. Tune this list over time based on what
// articles end up mis-tagged during real use.
const MACRO_KEYWORDS = [
  'federal reserve',
  'fed ',
  'fomc',
  'interest rate',
  'rate cut',
  'rate hike',
  'cpi',
  'inflation',
  'gdp',
  'opec',
  'geopolitical',
  'recession',
  'central bank',
  'treasury yield',
  'jobs report',
  'nonfarm payroll',
  'unemployment rate',
];

function checkIsMacro(title: string, description: string, keywords: string = ''): boolean {
  const haystack = `${title} ${description} ${keywords}`.toLowerCase();
  return MACRO_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

// Filename/path patterns that indicate a site-brand logo, twitter-card
// default, or favicon-style placeholder rather than a real article photo.
// Confirmed live on 2026-08-27: stockmarketwatch.com and gurufocus.com both
// supply a generic branded icon as image_url on articles that have no real
// photo, rather than omitting image_url entirely. This filter treats those
// as if no image were provided, so the frontend's asset-tinted gradient
// fallback shows instead of a generic logo tile.
//
// Deliberately pattern-based, not "same URL seen more than once", since
// some sources legitimately reuse a real photo across a recurring editorial
// segment (e.g. a "Gold prices today" daily column reusing one template
// image) and that repetition is intentional, not a placeholder problem.
// Tune this list over time based on what still slips through in real use.
const GENERIC_IMAGE_PATTERNS = [
  'logo',
  'icon-1000x700',
  'twitter_card',
  'twitter-card',
  'og-image',
  'og_image',
  'favicon',
  'placeholder',
];

function isGenericPlaceholderImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  const lower = imageUrl.toLowerCase();
  return GENERIC_IMAGE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Derives a single article-level sentiment score by averaging the
 * sentiment_score across all entities Marketaux returned for the article.
 *
 * Marketaux does NOT provide a top-level article sentiment field, sentiment
 * is only available per-entity (confirmed via real API response). Averaging
 * is a simple, defensible choice for articles with one or a handful of
 * entities. Entities with a null sentiment_score are excluded from the
 * average rather than treated as zero.
 */
function deriveSentimentScore(entities: MarketauxEntity[]): number | null {
  const scores = entities
    .map((e) => e.sentiment_score)
    .filter((s): s is number => typeof s === 'number');

  if (scores.length === 0) return null;

  const sum = scores.reduce((total, s) => total + s, 0);
  return sum / scores.length;
}

/**
 * Maps a Marketaux article's tagged entities onto Atlas's asset watchlist
 * by comparing entity symbols against each asset's finnhub_symbol.
 *
 * @param entities - entities array from a Marketaux article
 * @param assetsBySymbol - map of finnhub_symbol -> asset id, built once
 *   per ingestion run from the assets table (avoids a DB lookup per article)
 */
function matchAssetIds(
  entities: MarketauxEntity[],
  assetsBySymbol: Map<string, string>
): string[] {
  const matched = new Set<string>();
  for (const entity of entities) {
    const assetId = assetsBySymbol.get(entity.symbol.toUpperCase());
    if (assetId) {
      matched.add(assetId);
    }
  }
  return Array.from(matched);
}

// Single sequential call in phase 1, so a generous per-attempt timeout is
// affordable: the route has a 60s maxDuration and cron-job.org enforces a
// ~30s ceiling, and nothing else in phase 1 competes for that budget
// (unlike the per-article Gemini calls in phase 2).
// Budget is deliberately 2 attempts: worst case 12 + 1.5 + 12 = 25.5s,
// which fits under the ~30s cron-job.org ceiling with margin for phase 1's
// Supabase bookends. A 3rd attempt (40.5s worst case) would not fit.
const MARKETAUX_TIMEOUT_MS = 12000;
const MARKETAUX_MAX_ATTEMPTS = 2;
// Backoff between attempt 1 and 2. Kept local to this function;
// the Gemini client's retry helper is shaped for raw-text responses,
// not parsed article lists, so sharing it isn't worth it for one call site.
const MARKETAUX_RETRY_DELAYS_MS = [1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True for fetch-level failures worth retrying: the AbortSignal.timeout
 * case (DOMException TimeoutError) or a network failure where fetch throws
 * before a response exists (undici surfaces those as TypeError).
 * Deliberately narrow: HTTP statuses and JSON parse errors are handled
 * separately and must not be retried implicitly here.
 */
function isRetryableMarketauxFetchError(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return true;
  }
  return false;
}

/**
 * Fetches recent news from Marketaux for the given watchlist symbols and
 * returns articles mapped to Atlas's internal shape, ready for the
 * ingestRawArticles() write step.
 *
 * Retries up to 2 attempts on TimeoutError, network errors, or HTTP 5xx
 * only. 429 (rate limit), 402 (quota), and other non-5xx statuses are
 * terminal and thrown immediately, since retrying those cannot help and
 * could compound quota usage.
 *
 * @param symbols - comma-separated Finnhub symbols to filter on, e.g. "SPY,QQQ,GLD"
 * @param assetsBySymbol - map of finnhub_symbol -> asset id (uppercase keys)
 * @param limit - max articles to request per call (Marketaux free tier caps apply)
 */
export async function fetchMarketauxArticles(
  symbols: string,
  assetsBySymbol: Map<string, string>,
  limit: number = 20
): Promise<RawNewsArticle[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) {
    throw new Error('MARKETAUX_API_KEY is not set');
  }

  const url = `https://api.marketaux.com/v1/news/all?symbols=${encodeURIComponent(
    symbols
  )}&filter_entities=true&language=en&limit=${limit}&api_token=${apiKey}`;

  let data: MarketauxResponse | null = null;

  for (let attempt = 1; attempt <= MARKETAUX_MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MARKETAUX_MAX_ATTEMPTS;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(MARKETAUX_TIMEOUT_MS) });
    } catch (err) {
      if (!isRetryableMarketauxFetchError(err) || isLastAttempt) {
        if (isRetryableMarketauxFetchError(err)) {
          console.error(`[marketaux] exhausted retries after ${MARKETAUX_MAX_ATTEMPTS} attempts:`, err);
        }
        throw err;
      }
      await sleep(MARKETAUX_RETRY_DELAYS_MS[attempt - 1]);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      const httpError = new Error(`Marketaux fetch failed: ${res.status} ${body}`);
      const isServerError = res.status >= 500 && res.status <= 599;
      if (!isServerError || isLastAttempt) {
        if (isServerError) {
          console.error(`[marketaux] exhausted retries after ${MARKETAUX_MAX_ATTEMPTS} attempts:`, httpError);
        }
        throw httpError;
      }
      await sleep(MARKETAUX_RETRY_DELAYS_MS[attempt - 1]);
      continue;
    }

    data = (await res.json()) as MarketauxResponse;
    break;
  }

  return (data?.data || []).map((article) => {
    const description = article.description || '';
    const entities = article.entities || [];
    const matchedAssetIds = matchAssetIds(entities, assetsBySymbol);
    const isMacro = checkIsMacro(article.title, description, article.keywords);
    const sentimentScore = deriveSentimentScore(entities);

    return {
      marketauxUuid: article.uuid,
      title: article.title,
      description: description || null,
      url: article.url,
      imageUrl: isGenericPlaceholderImage(article.image_url) ? null : (article.image_url || null),
      source: article.source || null,
      publishedAt: article.published_at,
      sentimentScore,
      matchedAssetIds,
      isMacro,
    };
  });
}
