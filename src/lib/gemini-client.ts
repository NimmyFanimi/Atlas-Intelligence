// lib/gemini-client.ts
//
// Shared Gemini API client with retry logic.
//
// Extracted from the original `callGemini()` in
// lib/morning-brief-generation.ts so both the Morning Brief generator
// and the News Engine analysis path (`callGeminiForAnalysis` in
// lib/news-analysis.ts) share identical retry behavior: 3 attempts,
// 2s/4s backoff, retrying only on network errors or HTTP 429 / 5xx.
//
// The function returns the raw trimmed text string from the Gemini
// response, exactly as the original `callGemini` did. Callers that need
// structured parsing (e.g. News Engine JSON validation) do that
// themselves on top of the returned string.

const GEMINI_MODEL = 'gemini-3.6-flash';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2000, 4000];

function buildGeminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

function isDailyQuotaExhausted(status: number | null, bodyText: string): boolean {
  if (status !== 429) {
    return false;
  }
  const lowered = bodyText.toLowerCase();
  return lowered.includes('resource_exhausted') || lowered.includes('perday');
}

export function isRetryableGeminiError(status: number | null): boolean {
  if (status === null) {
    return true;
  }
  if (status === 429) {
    return true;
  }
  if (status >= 500 && status <= 599) {
    return true;
  }
  return false;
}

// Fallback calls are serialized (not run concurrently) because concurrent
// requests to the Gemini fallback endpoint were observed to intermittently
// hang until timeout, while sequential calls consistently succeeded in
// under 2 seconds. See isolated test results from 2026-09-10.
let fallbackQueue: Promise<unknown> = Promise.resolve();

function queueFallbackCall<T>(fn: () => Promise<T>): Promise<T> {
  const result = fallbackQueue.then(fn, fn);
  fallbackQueue = result.catch(() => undefined);
  return result;
}

async function attemptFallback(
  fallbackUrl: string,
  requestBody: string,
  fallbackTimeoutMs: number,
  primaryFailureDescription: string,
  onRequestAttempt?: (key: 'primary' | 'fallback') => void | Promise<void>,
  onFinishReason?: (finishReason: string) => void | Promise<void>
): Promise<string> {
  return await queueFallbackCall(async () => {
    await onRequestAttempt?.('fallback');
    let fallbackRes: Response;
    try {
      fallbackRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: AbortSignal.timeout(fallbackTimeoutMs),
      });
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      const bothFailed = new Error(
        `Gemini call failed on both primary and fallback keys: ${primaryFailureDescription}; fallback network error: ${fallbackMessage}`
      );
      console.error(`[gemini-client] ${bothFailed.message}`);
      throw bothFailed;
    }
    if (!fallbackRes.ok) {
      const fallbackBody = await fallbackRes.text();
      const bothFailed = new Error(
        `Gemini call failed on both primary and fallback keys: ${primaryFailureDescription}; fallback ${fallbackRes.status} ${fallbackBody}`
      );
      console.error(`[gemini-client] ${bothFailed.message}`);
      throw bothFailed;
    }
    const fallbackData = await fallbackRes.json();
    const fallbackFinishReason: unknown = fallbackData?.candidates?.[0]?.finishReason;
    if (typeof fallbackFinishReason === 'string') {
      await onFinishReason?.(fallbackFinishReason);
    }
    const fallbackText =
      fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof fallbackText !== 'string') {
      const fallbackShapeMessage = `Gemini fallback key response had unexpected shape: ${JSON.stringify(fallbackData)}`;
      console.error(`[gemini-client] ${fallbackShapeMessage}`);
      throw new Error(fallbackShapeMessage);
    }
    return fallbackText.trim();
  });
}

export async function callGeminiWithRetry(
  prompt: string,
  options?: {
    timeoutMs?: number;
    fallbackTimeoutMs?: number;
    maxAttempts?: number;
    retryDelaysMs?: number[];
    apiKey?: string;
    fallbackApiKey?: string;
    // Called before every HTTP attempt with which key the attempt uses.
    // News Engine passes a budget-logging callback; Morning Brief omits it.
    onRequestAttempt?: (key: 'primary' | 'fallback') => void | Promise<void>;
    // Optional generation config for the request. Included in the request
    // body only when provided; when omitted the body is byte-identical to
    // a plain { contents } request (Morning Brief omits it).
    generationConfig?: {
      responseMimeType?: string;
      maxOutputTokens?: number;
      temperature?: number;
    };
    // Receives candidates[0].finishReason when the response includes one.
    // Same optional-hook pattern as onRequestAttempt.
    onFinishReason?: (finishReason: string) => void | Promise<void>;
  }
): Promise<string> {
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const fallbackApiKey = options?.fallbackApiKey ?? process.env.GEMINI_API_KEY_FALLBACK;

  const url = buildGeminiUrl(apiKey);
  const fallbackUrl = fallbackApiKey ? buildGeminiUrl(fallbackApiKey) : null;

  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
  const retryDelaysMs = options?.retryDelaysMs ?? RETRY_DELAYS_MS;

  const requestBody = JSON.stringify(
    options?.generationConfig !== undefined
      ? {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: options.generationConfig,
        }
      : {
          contents: [{ parts: [{ text: prompt }] }],
        }
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isLastAttempt = attempt === maxAttempts;

    let res: Response;
    try {
      await options?.onRequestAttempt?.('primary');
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        ...(options?.timeoutMs !== undefined
          ? { signal: AbortSignal.timeout(options.timeoutMs) }
          : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isRetryableGeminiError(null) && fallbackUrl) {
        console.warn(
          '[gemini-client] primary key timed out, falling back to secondary key'
        );
        const fallbackTimeoutMs = options?.fallbackTimeoutMs ?? 6000;
        const primaryFailureDescription = `primary network error: ${message}`;
        return await attemptFallback(
          fallbackUrl,
          requestBody,
          fallbackTimeoutMs,
          primaryFailureDescription,
          options?.onRequestAttempt,
          options?.onFinishReason
        );
      }
      if (!isLastAttempt && isRetryableGeminiError(null)) {
        const delayMs = retryDelaysMs[attempt - 1];
        console.warn(
          `callGeminiWithRetry: attempt ${attempt} failed with network error: ${message}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      const finalError = err instanceof Error ? err : new Error(message);
      console.error(
        `[gemini-client] exhausted retries after ${maxAttempts} attempts: ${finalError.message}`
      );
      throw finalError;
    }

    if (!res.ok) {
      const body = await res.text();
      if (isDailyQuotaExhausted(res.status, body) && fallbackUrl) {
        console.warn(
          '[gemini-client] primary key quota exhausted, falling back to secondary key'
        );
        const fallbackTimeoutMs = options?.fallbackTimeoutMs ?? 6000;
        const primaryFailureDescription = `primary quota exhausted (${res.status} ${body})`;
        return await attemptFallback(
          fallbackUrl,
          requestBody,
          fallbackTimeoutMs,
          primaryFailureDescription,
          options?.onRequestAttempt,
          options?.onFinishReason
        );
      }
      const error = new Error(`Gemini call failed: ${res.status} ${body}`);
      if (!isLastAttempt && isRetryableGeminiError(res.status)) {
        const delayMs = retryDelaysMs[attempt - 1];
        console.warn(
          `callGeminiWithRetry: attempt ${attempt} failed with status ${res.status}: ${body}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      console.error(
        `[gemini-client] exhausted retries after ${maxAttempts} attempts: ${error.message}`
      );
      throw error;
    }

    const data = await res.json();
    const finishReason: unknown = data?.candidates?.[0]?.finishReason;
    if (typeof finishReason === 'string') {
      await options?.onFinishReason?.(finishReason);
    }
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawText !== 'string') {
      const errorMessage = `Gemini response had unexpected shape: ${JSON.stringify(data)}`;
      console.error(
        `[gemini-client] exhausted retries after ${maxAttempts} attempts: ${errorMessage}`
      );
      throw new Error(errorMessage);
    }

    return rawText.trim();
  }

  // Unreachable: the loop above always returns or throws.
  const exhaustedMessage = 'Gemini call failed: retries exhausted without a result';
  console.error(
    `[gemini-client] exhausted retries after ${maxAttempts} attempts: ${exhaustedMessage}`
  );
  throw new Error(exhaustedMessage);
}
