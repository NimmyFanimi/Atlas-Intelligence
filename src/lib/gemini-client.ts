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
  options?: { timeoutMs?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        ...(options?.timeoutMs !== undefined
          ? { signal: AbortSignal.timeout(options.timeoutMs) }
          : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isLastAttempt && isRetryableGeminiError(null)) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1];
        console.warn(
          `callGeminiWithRetry: attempt ${attempt} failed with network error: ${message}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      const finalError = err instanceof Error ? err : new Error(message);
      console.error(
        `[gemini-client] exhausted retries after ${MAX_ATTEMPTS} attempts: ${finalError.message}`
      );
      throw finalError;
    }

    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`Gemini call failed: ${res.status} ${body}`);
      if (!isLastAttempt && isRetryableGeminiError(res.status)) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1];
        console.warn(
          `callGeminiWithRetry: attempt ${attempt} failed with status ${res.status}: ${body}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      console.error(
        `[gemini-client] exhausted retries after ${MAX_ATTEMPTS} attempts: ${error.message}`
      );
      throw error;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawText !== 'string') {
      const errorMessage = `Gemini response had unexpected shape: ${JSON.stringify(data)}`;
      console.error(
        `[gemini-client] exhausted retries after ${MAX_ATTEMPTS} attempts: ${errorMessage}`
      );
      throw new Error(errorMessage);
    }

    return rawText.trim();
  }

  // Unreachable: the loop above always returns or throws.
  const exhaustedMessage = 'Gemini call failed: retries exhausted without a result';
  console.error(
    `[gemini-client] exhausted retries after ${MAX_ATTEMPTS} attempts: ${exhaustedMessage}`
  );
  throw new Error(exhaustedMessage);
}
