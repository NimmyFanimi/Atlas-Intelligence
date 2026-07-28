// Finnhub /quote response shape
export interface FinnhubQuote {
  c: number;   // Current price
  d: number;   // Change
  dp: number;  // Change percent
  h: number;   // High
  l: number;   // Low
  o: number;   // Open
  pc: number;  // Previous close
  t: number;   // Timestamp (Unix)
}

export interface QuoteResult {
  price: number;
  change_abs: number;
  change_pct: number;
  prev_close: number;
  high: number;
  low: number;
  open: number;
  timestamp: Date;
}

export async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not set');

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Finnhub /quote [${symbol}] failed: HTTP ${res.status}`);
  }

  const data: FinnhubQuote = await res.json();

  // Finnhub returns all-zero/null body for unknown or unsupported symbols
  if (data.c === 0 && data.d === null) {
    throw new Error(`Finnhub /quote [${symbol}] returned empty data — symbol may be invalid or unsupported`);
  }

  return {
    price: data.c,
    change_abs: data.d,
    change_pct: data.dp,
    prev_close: data.pc,
    high: data.h,
    low: data.l,
    open: data.o,
    timestamp: new Date(data.t * 1000),
  };
}
