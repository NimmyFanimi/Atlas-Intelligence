import { supabase } from '@/lib/supabase/client';
import type { NewsAiAnalysis } from '@/components/news/NewsCard';

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
