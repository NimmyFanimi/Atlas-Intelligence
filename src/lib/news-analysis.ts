// lib/news-analysis.ts
//
// Phase 2 of the two-phase News Engine ingestion model.
// analyzeUnprocessedArticles() finds news_articles rows where ai_analysis
// IS NULL, runs each through the analyst-persona prompt against Gemini
// 3.6 Flash, and writes the parsed result back. analyzeBacklogArticles()
// is the hourly backlog-only entry point: same query shape and same
// oldest-first ordering, larger batch, no ingestion attached.
//
// This is deliberately separate from phase 1 (ingestRawArticles, in
// news-ingestion.ts). A Gemini failure on one article never blocks or
// corrupts raw article storage, it just leaves that row null and the
// next run picks it up again automatically, since the query is always
// "find rows where ai_analysis IS NULL", not tied to a specific run.
//
// Reprocessing later (e.g. an improved prompt in a future week) is just:
// null out ai_analysis for the rows you want redone, next run handles it.
//
// Daily budget: every Gemini HTTP attempt in this file (success or
// failure, including 503s) is counted in gemini_usage_log via the
// onRequestAttempt hook, and resolveGeminiKey() picks primary or fallback
// before each article. Both cron routes share this file, so they share
// one budget. Morning Brief uses its own separate key and never touches
// this budget.

import { supabaseAdmin } from './supabase/admin';
import { callGeminiWithRetry } from './gemini-client';
import {
  GEMINI_SAFE_THRESHOLD,
  QuotaExhaustedError,
  incrementGeminiUsage,
  markGeminiKeyExhausted,
  resolveGeminiKey,
} from './gemini-usage';

const GEMINI_MODEL = 'gemini-3.6-flash';

// Small delay between consecutive Gemini calls so a burst of articles in
// one run never stacks more requests than the free-tier RPM limit into
// the same 60-second window. Confirmed live limit for this project is
// 5 RPM, and observed peak usage is only ~3 RPM, so 800ms between calls
// still leaves real headroom.
const DELAY_BETWEEN_CALLS_MS = 800;

// Caps how many unanalyzed articles the main cron processes per run.
// Raised from 2 to 4 now that the route runs under GitHub Actions
// (60s maxDuration, no 30s external ceiling) with an elapsed-time guard
// below: realistic per-article cost is ~5-10s, so 4 articles typically
// land around 20-40s plus inter-call delays, inside the guard. Worst
// case (15s primary timeout x 3 retry attempts + 2s/4s backoff + 6s
// fallback = ~57s for one unlucky article) is what the guard exists for:
// it stops starting new articles once elapsed time passes TIME_GUARD_MS,
// so a slow article delays the batch instead of pushing the run past
// maxDuration.
const MAX_ARTICLES_PER_RUN = 4;

// Backlog cron batch. Larger than the main cron because this route does
// no Marketaux fetch and exists only to drain backlog. Same guard
// applies: 6 articles realistic cost is ~30-60s, so the guard will often
// stop the batch at 4-5 articles on slow runs. That is intended: partial
// progress every hour still drains steadily, and the next hourly run
// picks up where this one stopped (oldest-first ordering).
const BACKLOG_MAX_ARTICLES_PER_RUN = 6;

// Stop starting new articles once a run has been going this long,
// leaving margin under the route 60s maxDuration for the final DB write
// and response. Applies to both the main and backlog entry points.
// Worst-case math: one article can cost up to ~57s (15s timeout x 3
// attempts + 2s + 4s backoff + 6s fallback), so the guard cannot bound
// a single in-flight call, it only prevents starting fresh work with no
// time left. 45000 leaves 15s for the in-flight write plus response.
const TIME_GUARD_MS = 45000;

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

export interface AnalysisBatchResult {
  found: number;
  analyzed: number;
  failed: number;
  failedReasons: string[];
  skipped: number;
  reason?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logPossibleRateLimit(runId: string, articleId: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (/429|quota|rate limit/i.test(message)) {
    console.warn(`[news-analysis] run=${runId} article=${articleId} LIKELY RATE LIMIT ISSUE: ${message}`);
  }
}

// Diagnostic-only helper: formats one failed article's reason for the
// cron JSON response so it persists in GitHub Actions run logs. Keeps
// only the article id plus the error message truncated to 200 chars.
// Strips any "key=..." query value so a URL containing an API key can
// never leak into logs via an error message.
function formatFailureReason(articleId: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const sanitized = raw.replace(/key=[^&\s"']*/gi, 'key=[REDACTED]');
  return `id ${articleId}: ${sanitized.slice(0, 200)}`;
}

// Builds a public-log-safe payload summary for parse failures: finish
// reason, payload length, and short head/tail slices only. The repo and
// Actions logs are public, so the full model response must never appear
// in these messages; head and tail are enough to tell preamble junk
// apart from a cut-off tail. Applies the same key redaction as
// formatFailureReason.
function describeParsePayload(cleaned: string, finishReason: string | undefined): string {
  const redact = (s: string): string => s.replace(/key=[^&\s"']*/gi, 'key=[REDACTED]');
  const head = redact(cleaned.slice(0, 80));
  const tail = cleaned.length > 80 ? ` ... ${redact(cleaned.slice(-80))}` : '';
  return `(finishReason=${finishReason ?? 'unknown'}, chars=${cleaned.length}): ${head}${tail}`;
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
 * as a JSON AnalystNote. Budget-aware: resolves primary vs fallback
 * through the shared daily budget before calling, and counts every HTTP
 * attempt (including 503s) in gemini_usage_log. Throws
 * QuotaExhaustedError when both keys are at or above the safe threshold
 * so the caller can stop the batch gracefully. Throws on API failure or
 * malformed JSON, the caller decides what happens to that article
 * (currently: skip it, leave ai_analysis null, it will be retried later).
 *
 * Retries use the shared client defaults (3 attempts, 2s/4s backoff on
 * network errors and 429/5xx). A 503 is therefore retried in-call before
 * it ever surfaces here.
 */
async function callGeminiForAnalysis(article: UnanalyzedArticle): Promise<AnalystNote> {
  const prompt = buildAnalystPrompt(article);
  const resolved = await resolveGeminiKey();

  if (!resolved) {
    throw new QuotaExhaustedError(
      `News Engine Gemini budget exhausted for today (primary and fallback at or above safe threshold ${GEMINI_SAFE_THRESHOLD})`
    );
  }

  // JSON mode is enforced via generationConfig (no maxOutputTokens: on a
  // thinking model, thinking tokens count toward it and a low value would
  // cut the response off; temperature is left at the default). The finish
  // reason is captured for parse-failure diagnosis, it is the only signal
  // that distinguishes a MAX_TOKENS cutoff from malformed output.
  let finishReason: string | undefined;

  // Forced-fallback mode: drive the fallback key as the primary URL with
  // no further fallback behind it, and count all attempts to fallback.
  const callOptions =
    resolved === 'primary'
      ? {
          timeoutMs: 15000,
          fallbackTimeoutMs: 6000,
          onRequestAttempt: (key: 'primary' | 'fallback') => incrementGeminiUsage(key),
          onQuotaExhausted: (key: 'primary' | 'fallback') => markGeminiKeyExhausted(key),
          generationConfig: { responseMimeType: 'application/json' },
          onFinishReason: (reason: string) => {
            finishReason = reason;
          },
        }
      : (() => {
          const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;
          if (!fallbackKey) {
            throw new QuotaExhaustedError('Fallback key has budget but GEMINI_API_KEY_FALLBACK is not set');
          }
          return {
            timeoutMs: 15000,
            apiKey: fallbackKey,
            fallbackApiKey: undefined as unknown as string | undefined,
            onRequestAttempt: () => incrementGeminiUsage('fallback'),
            onQuotaExhausted: () => markGeminiKeyExhausted('fallback'),
            generationConfig: { responseMimeType: 'application/json' },
            onFinishReason: (reason: string) => {
              finishReason = reason;
            },
          };
        })();

  let rawText: string;
  try {
    rawText = await queueGeminiCall(() => callGeminiWithRetry(prompt, callOptions));
  } catch (err) {
    if (err instanceof QuotaExhaustedError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes(article.id)) {
      throw err;
    }
    const stripped = message.replace(/^Gemini call failed(?:: | with )/, '');
    throw new Error(`Gemini call failed for article ${article.id}: ${stripped}`);
  }

  // Defensive: strip markdown code fences if the model added them despite
  // instructions not to, this is a common small-model quirk.
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  let parsed: AnalystNote;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // No retry here on purpose: every request counts against the daily
    // budget, and a malformed response will not fix itself on resend.
    // A MAX_TOKENS finish means the response was cut off at the token
    // limit rather than malformed by the model.
    const cutoff =
      finishReason === 'MAX_TOKENS'
        ? ' Response was cut off at the token limit (MAX_TOKENS).'
        : '';
    throw new Error(
      `parse failure for article ${article.id} ${describeParsePayload(cleaned, finishReason)}.${cutoff}`
    );
  }

  if (!parsed.what_happened || !parsed.why_it_matters || !parsed.trade_read) {
    throw new Error(
      `missing required fields for article ${article.id} ${describeParsePayload(cleaned, finishReason)}`
    );
  }

  return parsed;
}

// Concurrent calls to callGeminiWithRetry were found to intermittently
// hang until timeout on BOTH the primary and fallback Gemini keys (see
// isolated concurrent test results from 2026-09-10). Serializing all
// Gemini calls here (not just fallback calls) avoids this. This queue
// is local to news-analysis.ts rather than gemini-client.ts because
// Morning Brief (which also uses gemini-client.ts) does not run
// concurrent calls and should not be forced to serialize unnecessarily.
let geminiCallQueue: Promise<unknown> = Promise.resolve();

function queueGeminiCall<T>(fn: () => Promise<T>): Promise<T> {
  const result = geminiCallQueue.then(fn, fn);
  geminiCallQueue = result.catch(() => undefined);
  return result;
}

// Lightweight presence check: does any row still need analysis. Used by
// the backlog route to short-circuit before any budget check or Gemini
// call when there is nothing to do.
export async function hasUnanalyzedArticles(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('news_articles')
    .select('id')
    .is('ai_analysis', null)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check for unanalyzed articles: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

// Shared sequential batch processor for both cron entry points. Fetches
// up to batchLimit oldest unanalyzed rows, then processes them one at a
// time: elapsed-time guard first (stop starting new work past the guard),
// then the per-article Gemini call (which itself enforces the daily
// budget). Quota exhaustion stops the whole batch, since further articles
// would hit the same wall. Never throws for quota or per-article
// failures, those are reported in the result. Only throws on the initial
// fetch failing.
async function processArticleBatch(
  batchLimit: number,
  timeGuardMs: number,
  runTag: string
): Promise<AnalysisBatchResult> {
  const { data, error } = await supabaseAdmin
    .from('news_articles')
    .select('id, title, description, source')
    .is('ai_analysis', null)
    .order('published_at', { ascending: true })
    .limit(batchLimit);

  if (error) {
    throw new Error(`Failed to fetch unanalyzed articles: ${error.message}`);
  }

  const articles = (data || []) as UnanalyzedArticle[];
  let analyzed = 0;
  let failed = 0;
  let skipped = 0;
  const failedReasons: string[] = [];
  let reason: string | undefined;

  const runId = new Date().toISOString();
  const runStartMs = Date.now();

  console.log(`[news-analysis] run=${runId} tag=${runTag} articles=${articles.length} starting`);

  for (let i = 0; i < articles.length; i++) {
    if (Date.now() - runStartMs > timeGuardMs) {
      skipped = articles.length - i;
      reason = 'time budget';
      console.log(
        `[news-analysis] run=${runId} tag=${runTag} stopping: elapsed time past guard, skipped=${skipped}`
      );
      break;
    }

    const article = articles[i];
    console.log(`[news-analysis] run=${runId} article=${article.id} starting`);
    const articleStartMs = Date.now();
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
      console.log(`[news-analysis] run=${runId} article=${article.id} duration=${Date.now() - articleStartMs}ms status=success`);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        skipped = articles.length - i;
        reason = 'quota near cap';
        console.warn(`[news-analysis] run=${runId} stopping batch: ${err.message}`);
        break;
      }
      // Log and continue, this article stays null and gets retried later.
      console.error(`Analysis failed for article ${article.id}:`, err);
      failed += 1;
      failedReasons.push(formatFailureReason(article.id, err));
      console.log(`[news-analysis] run=${runId} article=${article.id} duration=${Date.now() - articleStartMs}ms status=failed`);
      logPossibleRateLimit(runId, article.id, err);
    }

    // Respect the free-tier RPM limit even under a larger backlog.
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  console.log(
    `[news-analysis] run=${runId} tag=${runTag} totalDuration=${Date.now() - runStartMs}ms found=${articles.length} analyzed=${analyzed} failed=${failed} skipped=${skipped} done`
  );

  return { found: articles.length, analyzed, failed, failedReasons, skipped, reason };
}

/**
 * Main cron entry: up to MAX_ARTICLES_PER_RUN oldest unanalyzed rows.
 * See processArticleBatch for guard, budget, and failure semantics.
 */
export async function analyzeUnprocessedArticles(): Promise<AnalysisBatchResult> {
  return processArticleBatch(MAX_ARTICLES_PER_RUN, TIME_GUARD_MS, 'main');
}

/**
 * Backlog cron entry: up to BACKLOG_MAX_ARTICLES_PER_RUN oldest
 * unanalyzed rows, no ingestion attached. The route checks
 * hasUnanalyzedArticles() first and never calls this when the backlog
 * is empty.
 */
export async function analyzeBacklogArticles(): Promise<AnalysisBatchResult> {
  return processArticleBatch(BACKLOG_MAX_ARTICLES_PER_RUN, TIME_GUARD_MS, 'backlog');
}
