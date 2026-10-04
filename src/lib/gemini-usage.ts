// lib/gemini-usage.ts
//
// Shared daily budget tracking for News Engine Gemini calls.
//
// Both the main news-ingest cron (analyzeUnprocessedArticles) and the
// hourly backlog cron (analyzeBacklogArticles) draw from the same two
// free-tier keys (GEMINI_API_KEY primary, GEMINI_API_KEY_FALLBACK), each
// capped at 20 requests/day by Google. This module keeps a per-day,
// per-key counter in the gemini_usage_log table so either caller can check
// remaining budget before starting a new article analysis.
//
// Counting rule: increment on every HTTP attempt (success or failure,
// including 503s), because failed attempts still consume requests against
// the Google-side cap. The increment hook is wired through
// callGeminiWithRetry's onRequestAttempt callback in news-analysis.ts,
// never from Morning Brief, which uses its own separate key and is out
// of scope here.
//
// Failure policy: budget-table errors fail open (log a warning, allow the
// call). A logging outage must not halt the whole analysis pipeline; the
// reactive 429/resource_exhausted fallback in gemini-client.ts remains as
// the backstop.

import { supabaseAdmin } from './supabase/admin';

export type GeminiKeyId = 'primary' | 'fallback';

// Google free-tier daily cap per key.
export const GEMINI_DAILY_CAP = 20;

// Stop starting new analyses once a key reaches this count, leaving
// headroom below the hard cap for in-flight retries. See the threshold
// discussion in news-analysis.ts for why this alone is not a hard
// guarantee under 3-attempt retries.
export const GEMINI_SAFE_THRESHOLD = 17;

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

// UTC day in YYYY-MM-DD form, the grain of one budget row.
export function utcDay(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

interface UsageRow {
  request_count: number;
}

async function getUsageForDay(day: string, key: GeminiKeyId): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('gemini_usage_log')
    .select('request_count')
    .eq('usage_date', day)
    .eq('key_identifier', key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read gemini usage for ${key} on ${day}: ${error.message}`);
  }

  return ((data as UsageRow | null)?.request_count ?? 0);
}

// Today's counts for both News Engine keys. Throws on DB error so the
// caller can decide fail-open vs fail-closed.
export async function getTodayGeminiUsage(): Promise<Record<GeminiKeyId, number>> {
  const day = utcDay();
  const [primary, fallback] = await Promise.all([
    getUsageForDay(day, 'primary'),
    getUsageForDay(day, 'fallback'),
  ]);
  return { primary, fallback };
}

// Best-effort increment, never throws. A logging failure must not break
// analysis; it only means today's counts drift low until the next
// successful write.
export async function incrementGeminiUsage(key: GeminiKeyId, count = 1): Promise<void> {
  try {
    const day = utcDay();
    const current = await getUsageForDay(day, key);
    const { error } = await supabaseAdmin.from('gemini_usage_log').upsert(
      {
        usage_date: day,
        key_identifier: key,
        request_count: current + count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'usage_date,key_identifier' }
    );
    if (error) {
      console.warn(`[gemini-usage] increment failed for ${key}: ${error.message}`);
    }
  } catch (err) {
    console.warn(`[gemini-usage] increment failed for ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Which key, if any, still has budget for a new article. Checks primary
// first, then fallback, against each key's own threshold.
export async function resolveGeminiKey(): Promise<GeminiKeyId | null> {
  let usage: Record<GeminiKeyId, number>;
  try {
    usage = await getTodayGeminiUsage();
  } catch (err) {
    // Fail open: if the budget table is unreachable, allow the call and
    // let the reactive 429 handling in gemini-client.ts be the backstop.
    console.warn(
      `[gemini-usage] budget check failed, allowing call: ${err instanceof Error ? err.message : String(err)}`
    );
    return 'primary';
  }

  if (usage.primary < GEMINI_SAFE_THRESHOLD) return 'primary';
  if (usage.fallback < GEMINI_SAFE_THRESHOLD) return 'fallback';
  return null;
}
