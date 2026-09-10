import 'dotenv/config';

async function singleCall(label: string, url: string, body: string) {
  const start = new Date();
  const startMs = Date.now();
  console.log(`[${label}] Start time:`, start.toISOString());
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const end = new Date();
    const durationMs = Date.now() - startMs;
    console.log(`[${label}] End time:`, end.toISOString());
    console.log(`[${label}] Duration ms:`, durationMs);
    console.log(`[${label}] Status:`, res.status, res.statusText);
    const text = await res.text();
    console.log(`[${label}] Body:`, text);
    return { label, start: start.toISOString(), end: end.toISOString(), durationMs, ok: true as const };
  } catch (err) {
    const end = new Date();
    const durationMs = Date.now() - startMs;
    console.log(`[${label}] End time:`, end.toISOString());
    console.log(`[${label}] Duration ms:`, durationMs);
    console.log(`[${label}] Error name:`, err instanceof Error ? err.name : 'unknown');
    console.log(`[${label}] Error message:`, err instanceof Error ? err.message : String(err));
    console.log(`[${label}] Full error:`, err);
    return { label, start: start.toISOString(), end: end.toISOString(), durationMs, ok: false as const, errorName: err instanceof Error ? err.name : 'unknown', errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;
  if (!fallbackKey) {
    console.log('GEMINI_API_KEY_FALLBACK is not set');
    return;
  }

  const GEMINI_MODEL = 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${fallbackKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: 'Say hello in one word' }] }],
  });

  console.log('Firing two concurrent fallback calls...');
  const results = await Promise.allSettled([
    singleCall('call-1', url, body),
    singleCall('call-2', url, body),
  ]);

  console.log('Summary:');
  for (const r of results) {
    if (r.status === 'fulfilled') {
      console.log(JSON.stringify(r.value));
    } else {
      console.log('rejected:', r.reason);
    }
  }
}

main();
