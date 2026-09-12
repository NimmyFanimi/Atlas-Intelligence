import { supabase } from '@/lib/supabase/client';
import type { NewsAiAnalysis, NewsArticle } from '@/components/news/NewsCard';

export interface ArticleAnalysis {
  ai_analysis: NewsAiAnalysis | null;
  ai_model_used: string | null;
}

/**
 * One-shot client-side refetch of a single article's AI analysis.
 *
 * The /news page is ISR-cached (revalidate = 300), so an article that was
 * still pending (ai_analysis = null) when the page was generated keeps
 * showing "Analysis pending" in the modal even after the news cron fills the
 * value in Supabase. Callers should only call this when the cached article
 * shows pending; a single row is selected by id (ai_analysis and
 * ai_model_used only, not the whole row) using the anon browser client, which
 * is allowed by the public-read RLS policy on news_articles.
 *
 * Returns null when the row is missing or still pending. Throws on transport
 * or query errors so the caller can fall back to cached state.
 */
export async function fetchArticleAnalysis(articleId: string): Promise<ArticleAnalysis | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('ai_analysis, ai_model_used')
    .eq('id', articleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load article analysis: ${error.message}`);
  }

  if (!data) return null;

  return {
    ai_analysis: (data.ai_analysis as NewsAiAnalysis | null) ?? null,
    ai_model_used: (data.ai_model_used as string | null) ?? null,
  };
}

interface RecentArticleRow {
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
 * One-shot client-side fetch of the most recent articles.
 *
 * The /news page list is ISR-cached, so rows inserted by the news cron after
 * the page was generated are invisible until regeneration. This fetches a
 * small recent batch directly with the anon browser client and lets the
 * caller merge any ids not already present. Same column list and same row
 * shaping as getNewsFeed in lib/news.ts, so merged rows render identically.
 *
 * Returns null on query error (logs a console warn) so a failed fetch never
 * breaks the page, it just means no new articles merge on that attempt.
 */
export async function fetchRecentArticles(limit = 10): Promise<NewsArticle[] | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(
      'id, marketaux_uuid, title, description, url, source, published_at, sentiment_score, matched_asset_ids, is_macro, ai_analysis, ai_model_used, image_url'
    )
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[newsAnalysis] fetchRecentArticles failed, keeping cached list:', error);
    return null;
  }

  if (!data) return null;

  return ((data ?? []) as RecentArticleRow[]).map((row) => ({
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
}
