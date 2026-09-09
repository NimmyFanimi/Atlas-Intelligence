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

export async function callGeminiWithRetry(
  prompt: string,
  options?: { timeoutMs?: number; fallbackTimeoutMs?: number; maxAttempts?: number; retryDelaysMs?: number[] }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const fallbackApiKey = process.env.GEMINI_API_KEY_FALLBACK;

  const url = buildGeminiUrl(apiKey);
  const fallbackUrl = fallbackApiKey ? buildGeminiUrl(fallbackApiKey) : null;

  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
  const retryDelaysMs = options?.retryDelaysMs ?? RETRY_DELAYS_MS;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isLastAttempt = attempt === maxAttempts;

    let res: Response;
    try {
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
        const fallbackTimeoutMs = options?.fallbackTimeoutMs ?? 10000;
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
            `Gemini call failed on both primary and fallback keys: primary quota exhausted (${res.status} ${body}); fallback network error: ${fallbackMessage}`
          );
          console.error(`[gemini-client] ${bothFailed.message}`);
          throw bothFailed;
        }
        if (!fallbackRes.ok) {
          const fallbackBody = await fallbackRes.text();
          const bothFailed = new Error(
            `Gemini call failed on both primary and fallback keys: primary ${res.status} ${body}; fallback ${fallbackRes.status} ${fallbackBody}`
          );
          console.error(`[gemini-client] ${bothFailed.message}`);
          throw bothFailed;
        }
        const fallbackData = await fallbackRes.json();
        const fallbackText =
          fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof fallbackText !== 'string') {
          const fallbackShapeMessage = `Gemini fallback key response had unexpected shape: ${JSON.stringify(fallbackData)}`;
          console.error(`[gemini-client] ${fallbackShapeMessage}`);
          throw new Error(fallbackShapeMessage);
        }
        return fallbackText.trim();
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
