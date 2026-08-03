// lib/news-ingestion.ts
//
// Phase 1 of the two-phase News Engine ingestion model.
// ingestRawArticles() fetches from Marketaux and upserts raw articles into
// news_articles. It does NOT call any AI model, ai_analysis is left null
// here on purpose. Phase 2 (analyzeUnprocessedArticles, separate file)
// finds rows where ai_analysis IS NULL and processes them.
//
// This split means a Gemini failure never blocks raw article storage, and
// reprocessing later just means nulling out ai_analysis and re-running
// phase 2, no need to re-fetch from Marketaux.
//
// IMPORTANT: this file assumes a Supabase admin client export. Adjust the
// import path below (`./supabase-admin`) to match wherever your project's
// existing admin client actually lives, the same one your market-snapshot
// cron route already uses. Do not create a second admin client, reuse the
// existing one so there is exactly one place service-role credentials are
// constructed.

import { supabaseAdmin } from './supabase/admin';
import { fetchMarketauxArticles, RawNewsArticle } from './marketaux';

// The full watchlist symbol string passed to Marketaux, built from your
// 14 tradeable assets' finnhub_symbol values (the 2 FRED rate assets are
// intentionally excluded here, they have no real ticker Marketaux can
// tag against, see marketaux.ts comments for why).
const WATCHLIST_SYMBOLS = 'SPY,QQQ,DIA,EWU,FEZ,FXE,FXB,FXY,UUP,USO,BNO,GLD,UNG,CPER';

const MARKETAUX_FETCH_LIMIT = 20; // stays well within the 100 req/day free tier
  // even if this route runs several times a day

interface AssetRow {
  id: string;
  finnhub_symbol: string | null;
}

/**
 * Builds a lookup map of finnhub_symbol -> asset id from the assets table.
 * Built once per ingestion run and passed into fetchMarketauxArticles so
 * entity-symbol matching doesn't require a DB round-trip per article.
 */
async function buildAssetSymbolMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('id, finnhub_symbol')
    .not('finnhub_symbol', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch assets for symbol mapping: ${error.message}`);
  }

  const map = new Map<string, string>();
  for (const row of (data || []) as AssetRow[]) {
    if (row.finnhub_symbol) {
      map.set(row.finnhub_symbol.toUpperCase(), row.id);
    }
  }
  return map;
}

/**
 * Upserts a batch of raw articles into news_articles, keyed on the unique
 * marketaux_uuid constraint. Existing rows are left alone on conflict,
 * since a raw article's source data doesn't change after publication,
 * only its ai_analysis does (handled separately in phase 2).
 */
async function upsertArticles(articles: RawNewsArticle[]): Promise<{ inserted: number }> {
  if (articles.length === 0) {
    return { inserted: 0 };
  }

  const rows = articles.map((a) => ({
    marketaux_uuid: a.marketauxUuid,
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source,
    published_at: a.publishedAt,
    sentiment_score: a.sentimentScore,
    matched_asset_ids: a.matchedAssetIds,
    is_macro: a.isMacro,
  }));

  const { data, error } = await supabaseAdmin
    .from('news_articles')
    .upsert(rows, {
      onConflict: 'marketaux_uuid',
      ignoreDuplicates: true, // don't overwrite existing rows, ai_analysis
        // may already be populated on a previously-seen article
    })
    .select('id');

  if (error) {
    throw new Error(`Failed to upsert news_articles: ${error.message}`);
  }

  return { inserted: (data || []).length };
}

/**
 * Phase 1: fetch recent news from Marketaux, tag against the asset
 * watchlist, and upsert into news_articles. Safe to call repeatedly,
 * duplicate articles (by marketaux_uuid) are silently skipped.
 *
 * Does not throw on a partial/empty Marketaux result, only throws on a
 * genuine fetch or database failure, so the calling route can decide how
 * to log/report a hard failure versus a quiet "nothing new" run.
 */
export async function ingestRawArticles(): Promise<{
  fetched: number;
  inserted: number;
}> {
  const assetsBySymbol = await buildAssetSymbolMap();

  const articles = await fetchMarketauxArticles(
    WATCHLIST_SYMBOLS,
    assetsBySymbol,
    MARKETAUX_FETCH_LIMIT
  );

  const { inserted } = await upsertArticles(articles);

  return { fetched: articles.length, inserted };
}
