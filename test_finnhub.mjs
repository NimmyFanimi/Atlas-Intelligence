const API_KEY = process.env.FINNHUB_API_KEY;

if (!API_KEY) {
  console.error("No FINNHUB_API_KEY found in environment.");
  process.exit(1);
}

const symbolsToTest = [
  "SPY", "QQQ", "DIA", "EWU", "FEZ", // Indices
  "FXE", "FXB", "FXY", "UUP",        // FX
  "USO", "BNO", "GLD", "UNG", "CPER" // Commodities
];

async function testAll() {
  console.log(`Testing all ${symbolsToTest.length} ETF proxy symbols on /quote...`);
  
  let successCount = 0;
  let failCount = 0;

  for (const sym of symbolsToTest) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
      if (!res.ok) {
        console.error(`[FAIL] ${sym}: HTTP ${res.status}`);
        failCount++;
        continue;
      }
      
      const data = await res.json();
      
      // Finnhub returns 'c' = 0 if the symbol is completely invalid or has no data
      if (data.c === 0 && data.d === null && data.dp === null) {
        console.log(`[WARNING] ${sym}: Returned empty/zero data (might be invalid or unsupported)`);
        failCount++;
      } else {
        console.log(`[OK] ${sym} | Current Price: ${data.c}`);
        successCount++;
      }
    } catch (e) {
      console.error(`[ERROR] ${sym}:`, e.message);
      failCount++;
    }
    
    // Slight delay to avoid hammering the free tier (60 calls/min)
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\nTest Complete. Success: ${successCount}, Failed: ${failCount}`);
}

testAll();
