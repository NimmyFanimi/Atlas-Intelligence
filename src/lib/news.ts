import { supabaseAdmin } from '@/lib/supabase/admin';
import type { NewsArticle, NewsAiAnalysis } from '@/components/news/NewsCard';

export interface NewsFeedData {
  articles: NewsArticle[];
  // asset id -> ticker symbol, built from the assets table.
  assetsById: Record<string, string>;
  // asset id -> asset class ('index' | 'fx' | 'rate' | 'commodity'), built from
  // the assets table. Used to pick the article image-fallback palette.
  assetClassById: Record<string, string>;
}

interface AssetRow {
  id: string;
  symbol: string | null;
  finnhub_symbol: string | null;
  asset_class: string | null;
}

interface NewsRow {
  id: string;
  marketaux_uuid: string;
  title: string;
  description: string | null;
  url: string;
  source: string | null;
  published_at: string;
  sentiment_score: number | null;
  matched_asset_ids: string[] | null;
  is_macro: boolean;
  ai_analysis: unknown;
  ai_model_used: string | null;
  image_url: string | null;
}

/**
 * Loads the news feed: all news_articles rows (most recent first) plus an
 * asset id -> ticker symbol map for rendering ticker pills on every card.
 *
 * matched_asset_ids only stores asset UUIDs, so the symbol map has to be built
 * here (from the assets table) and passed down to NewsCard/NewsDetailPanel —
 * this is the first place that dependency is actually constructed.
 */
export async function getNewsFeed(): Promise<NewsFeedData> {
  const [{ data: assets, error: assetsError }, { data: articles, error: articlesError }] =
    await Promise.all([
      supabaseAdmin
        .from('assets')
        .select('id, symbol, finnhub_symbol, asset_class'),
      supabaseAdmin
        .from('news_articles')
        .select(
          'id, marketaux_uuid, title, description, url, source, published_at, sentiment_score, matched_asset_ids, is_macro, ai_analysis, ai_model_used, image_url'
        )
        .order('published_at', { ascending: false }),
    ]);

  if (assetsError) {
    throw new Error(`Failed to load assets: ${assetsError.message}`);
  }
  if (articlesError) {
    throw new Error(`Failed to load news articles: ${articlesError.message}`);
  }

  const assetsById: Record<string, string> = {};
  const assetClassById: Record<string, string> = {};
  for (const asset of (assets ?? []) as AssetRow[]) {
    const ticker = (asset.finnhub_symbol || asset.symbol || '').toUpperCase();
    if (ticker) assetsById[asset.id] = ticker;
    if (asset.asset_class) assetClassById[asset.id] = asset.asset_class;
  }

  const mapped: NewsArticle[] = ((articles ?? []) as NewsRow[]).map((row) => ({
    id: row.id,
    marketaux_uuid: row.marketaux_uuid,
    title: row.title,
    description: row.description,
    url: row.url,
    source: row.source,
    published_at: row.published_at,
    sentiment_score: row.sentiment_score,
    matched_asset_ids: row.matched_asset_ids ?? [],
    is_macro: row.is_macro,
    ai_analysis: (row.ai_analysis as NewsAiAnalysis | null) ?? null,
    ai_model_used: row.ai_model_used,
    image_url: row.image_url,
  }));

  return { articles: mapped, assetsById, assetClassById };
}