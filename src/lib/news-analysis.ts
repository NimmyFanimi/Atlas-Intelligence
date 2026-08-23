// lib/news-analysis.ts
//
// Phase 2 of the two-phase News Engine ingestion model.
// analyzeUnprocessedArticles() finds news_articles rows where ai_analysis
// IS NULL, runs each through the analyst-persona prompt against Gemini
// 3.6 Flash, and writes the parsed result back.
//
// This is deliberately separate from phase 1 (ingestRawArticles, in
// news-ingestion.ts). A Gemini failure on one article never blocks or
// corrupts raw article storage, it just leaves that row null and the
// next run picks it up again automatically, since the query is always
// "find rows where ai_analysis IS NULL", not tied to a specific run.
//
// Reprocessing later (e.g. an improved prompt in a future week) is just:
// null out ai_analysis for the rows you want redone, next run handles it.

import { supabaseAdmin } from './supabase/admin';

const GEMINI_MODEL = 'gemini-3.6-flash';

// Small delay between consecutive Gemini calls so a burst of articles in
// one run never stacks more requests than the free-tier RPM limit into
// the same 60-second window. Confirmed live limit for this project is
// 5 RPM, and observed peak usage is only ~3 RPM, so 800ms between calls
// (comfortably under the ~857ms floor 5 RPM would allow) still leaves
// real headroom while freeing up time budget against cron-job.org's hard
// 30-second timeout (see MAX_ARTICLES_PER_RUN below for the full reasoning).
const DELAY_BETWEEN_CALLS_MS = 800;

// Caps how many unanalyzed articles a single run processes. This exists
// specifically because cron-job.org's free tier enforces a hard 30-second
// request timeout, and this route's own maxDuration (60s) is irrelevant
// if the scheduler gives up waiting before then. A real run on 2026-08-04
// returned 200 from Vercel but still got marked "Failed (timeout)" by
// cron-job.org, confirming the server-side response was taking too long
// even with the previous cap of 5. Lowered to 2 here: worst case is
// roughly 2 x (call time + 0.8s), which stays comfortably under 30s even
// if individual Gemini calls run slow (3-4s each). Any backlog beyond
// this cap simply gets picked up on the next scheduled run (every 2
// hours), since the query is always "find rows where
// ai_analysis IS NULL", not tied to a specific run.
const MAX_ARTICLES_PER_RUN = 2;

interface UnanalyzedArticle {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
}

interface AnalystNote {
  what_happened: string;
  why_it_matters: string;
  trade_read: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same analyst-persona prompt verified in the Gemini vs Groq comparison
// test. Kept in sync manually with that test's prompt.js, if the prompt
// is revised here, consider updating the sandbox copy too so future
// model comparisons stay representative of production behavior.
function buildAnalystPrompt(article: {
  title: string;
  source: string | null;
  description: string | null;
}): string {
  return `You are a junior equity and macro analyst at a sell-side desk, three years into the job. You read this article closely before writing anything. You are not a news aggregator and you are not summarizing for a press release. You are writing a short internal note for a trading desk that already knows the basics of markets but has not read this specific article yet.

Your note has three parts. Respond with ONLY a JSON object, no markdown formatting, no code fences, no preamble. The JSON object must have exactly these three keys: what_happened, why_it_matters, trade_read.

what_happened: 2-3 sentences. State the concrete facts. No hedging language like "it appears" or "reportedly" unless the source itself is uncertain. Assume the reader is smart but busy.

why_it_matters: 2-4 sentences. This is the part that separates a real analyst from a summary bot. Connect this to a mechanism: what price, rate, flow, or positioning does this actually move, and through what channel. If there's a second-order effect (a sector that benefits indirectly, a currency that reacts, a spread that moves), say so specifically. Avoid vague statements like "this could impact markets." Say which markets, which direction, and roughly why.

trade_read: 1-2 sentences. A specific, honest take on what this means for positioning, framed as a desk note, not investment advice with disclaimers. It's fine to say "watch X" or "this favors Y over Z" or even "not tradeable on its own, but confirms the Q3 thesis on W." If the article genuinely has no clean trade angle, say that plainly instead of forcing one.

Style rules, follow strictly:
- Do not use the phrase "in today's fast-paced market" or any variant of it.
- Do not use "it's important to note that," "in conclusion," "overall," or similar filler.
- Do not hedge with "may potentially" or stack qualifiers. Pick a view and state it.
- Do not repeat the headline back as your first sentence.
- No bullet points within any field. Write in full sentences, like a person typing quickly but carefully.
- Total length: under 120 words across all three fields combined.
- Do not mention that you are an AI or that this is a summary.

Article title: ${article.title}
Article source: ${article.source || 'unknown'}
Article description: ${article.description || 'none provided'}

Respond now with only the JSON object.`;
}

/**
 * Calls Gemini 3.6 Flash with the analyst prompt and parses the response
 * as a JSON AnalystNote. Throws on API failure or malformed JSON, the
 * caller is responsible for deciding what happens to that article
 * (currently: skip it, leave ai_analysis null, it'll be retried next run).
 */
async function callGeminiForAnalysis(article: UnanalyzedArticle): Promise<AnalystNote> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = buildAnalystPrompt(article);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini call failed for article ${article.id}: ${res.status} ${body}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof rawText !== 'string') {
    throw new Error(
      `Gemini response for article ${article.id} had unexpected shape: ${JSON.stringify(data)}`
    );
  }

  // Defensive: strip markdown code fences if the model added them despite
  // instructions not to, this is a common small-model quirk.
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  let parsed: AnalystNote;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Failed to parse Gemini JSON response for article ${article.id}: ${cleaned}`
    );
  }

  if (!parsed.what_happened || !parsed.why_it_matters || !parsed.trade_read) {
    throw new Error(
      `Gemini response for article ${article.id} missing required fields: ${cleaned}`
    );
  }

  return parsed;
}

/**
 * Phase 2: finds all news_articles rows with ai_analysis IS NULL, runs
 * each through Gemini, and writes the result back. Processes articles
 * sequentially (not in parallel) with a delay between calls to respect
 * the free-tier RPM limit, this matters more here than in the earlier
 * comparison test since a real ingestion run could have more than a
 * couple of articles pending at once.
 *
 * A failure on one article is logged and skipped, not thrown, so one
 * bad Gemini response doesn't abort analysis for the rest of the batch.
 * Skipped articles simply remain ai_analysis = null and are retried on
 * the next run.
 */
export async function analyzeUnprocessedArticles(): Promise<{
  found: number;
  analyzed: number;
  failed: number;
}> {
  const { data, error } = await supabaseAdmin
    .from('news_articles')
    .select('id, title, description, source')
    .is('ai_analysis', null)
    .limit(MAX_ARTICLES_PER_RUN);

  if (error) {
    throw new Error(`Failed to fetch unanalyzed articles: ${error.message}`);
  }

  const articles = (data || []) as UnanalyzedArticle[];
  let analyzed = 0;
  let failed = 0;

  for (const article of articles) {
    try {
      const analysis = await callGeminiForAnalysis(article);

      const { error: updateError } = await supabaseAdmin
        .from('news_articles')
        .update({
          ai_analysis: analysis,
          ai_model_used: GEMINI_MODEL,
        })
        .eq('id', article.id);

      if (updateError) {
        throw new Error(`Failed to write analysis for article ${article.id}: ${updateError.message}`);
      }

      analyzed += 1;
    } catch (err) {
      // Log and continue, this article stays null and gets retried next run.
      console.error(`Analysis failed for article ${article.id}:`, err);
      failed += 1;
    }

    // Respect the free-tier RPM limit even under a larger backlog.
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return { found: articles.length, analyzed, failed };
}
