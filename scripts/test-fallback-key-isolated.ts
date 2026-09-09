import 'dotenv/config';

async function main() {
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;
  if (!fallbackKey) {
    console.log('GEMINI_API_KEY_FALLBACK is not set in .env.local');
    return;
  }
  console.log('Fallback key found, length:', fallbackKey.length);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${fallbackKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: 'Say the word "test" and nothing else.' }] }],
  });

  console.log('Sending request with a 30000ms timeout, no retries...');
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const elapsed = Date.now() - start;
    console.log('Response received after', elapsed, 'ms');
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log('Request failed after', elapsed, 'ms');
    console.log('Error:', err instanceof Error ? err.message : String(err));
    console.log('Error name:', err instanceof Error ? err.name : 'unknown');
  }
}

main();
