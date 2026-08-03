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

/**
 * Fetches recent news from Marketaux for the given watchlist symbols and
 * returns articles mapped to Atlas's internal shape, ready for the
 * ingestRawArticles() write step.
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

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Marketaux fetch failed: ${res.status} ${body}`);
  }

  const data: MarketauxResponse = await res.json();

  return (data.data || []).map((article) => {
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
      source: article.source || null,
      publishedAt: article.published_at,
      sentimentScore,
      matchedAssetIds,
      isMacro,
    };
  });
}
