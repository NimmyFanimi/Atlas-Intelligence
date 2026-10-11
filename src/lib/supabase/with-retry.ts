// lib/supabase/with-retry.ts
//
// Shared timeout plus one retry wrapper for server side Supabase reads used
// during build time and ISR revalidation on /news and /dashboard.
//
// Worst case math with defaults (timeoutMs 10000, attempts 2, backoffMs 1000):
// per fetch 10s + 1s + 10s = 21s; /news runs 2 fetches in parallel so 21s;
// /dashboard runs 2 sequential stages with Stage 2 fully parallel so 42s.
// That stays under the 60s default static generation timeout. A third attempt
// would break the budget (10 + 1 + 10 + 2 + 10 = 33s per fetch, 66s on
// /dashboard) and must not be added without revisiting it.
//
// Retry then rethrow, never empty fallback: on final failure a returned
// result is passed back unchanged so the caller error check throws as today,
// and a thrown error is rethrown. A failed build keeps the old deployment
// live, while an empty ISR result would overwrite good stale content.

const TRANSIENT_MESSAGE = /fetch failed|timed out|timeout|abort|network|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SupabaseRetryOptions {
  timeoutMs?: number;
  attempts?: number;
  backoffMs?: number;
}

export async function withSupabaseRetry<
  T extends { error: { message: string } | null; status: number },
>(
  label: string,
  makeQuery: (signal: AbortSignal) => PromiseLike<T>,
  options?: SupabaseRetryOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const attempts = options?.attempts ?? 2;
  const backoffMs = options?.backoffMs ?? 1000;

  let lastThrown: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const isLastAttempt = attempt === attempts;
    const signal = AbortSignal.timeout(timeoutMs);

    let result: T;
    try {
      result = await makeQuery(signal);
    } catch (err) {
      lastThrown = err;
      if (isLastAttempt) throw err;
      console.warn(`[supabase-retry] ${label} attempt ${attempt} threw, retrying`);
      await sleep(backoffMs);
      continue;
    }

    if (result.error === null || result.error === undefined) {
      return result;
    }

    const status = result.status;
    const message = result.error.message ?? '';
    const transient =
      status === 0 || status >= 500 || TRANSIENT_MESSAGE.test(message);

    if (!transient) {
      return result;
    }

    if (isLastAttempt) {
      return result;
    }

    console.warn(`[supabase-retry] ${label} attempt ${attempt} failed, retrying`);
    await sleep(backoffMs);
  }

  // Unreachable when attempts >= 1, kept for type safety.
  throw lastThrown instanceof Error ? lastThrown : new Error(String(lastThrown));
}
