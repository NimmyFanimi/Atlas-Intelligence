import 'dotenv/config';

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

  const start = new Date();
  const startMs = Date.now();
  console.log('Start time:', start.toISOString());

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const end = new Date();
    console.log('End time:', end.toISOString());
    console.log('Duration ms:', Date.now() - startMs);
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    const end = new Date();
    console.log('End time:', end.toISOString());
    console.log('Duration ms:', Date.now() - startMs);
    console.log('Error name:', err instanceof Error ? err.name : 'unknown');
    console.log('Error message:', err instanceof Error ? err.message : String(err));
    console.log('Full error:', err);
  }
}

main();
