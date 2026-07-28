import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Check .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('Verifying Supabase seed data via anon (public read) client...\n');

  // 1. Fetch all assets
  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .order('asset_class')
    .order('symbol');

  if (error) {
    console.error('[FAIL] Could not read assets table:', error.message);
    process.exit(1);
  }

  if (!assets || assets.length === 0) {
    console.error('[FAIL] assets table is empty. Did the seed run?');
    process.exit(1);
  }

  // 2. Print results grouped by asset_class
  console.log(`[OK] Read ${assets.length} assets from Supabase.\n`);

  const grouped = assets.reduce((acc, a) => {
    acc[a.asset_class] = acc[a.asset_class] || [];
    acc[a.asset_class].push(a);
    return acc;
  }, {});

  for (const [cls, items] of Object.entries(grouped)) {
    console.log(`--- ${cls.toUpperCase()} (${items.length}) ---`);
    for (const a of items) {
      const providerInfo = a.finnhub_symbol
        ? `Finnhub: ${a.finnhub_symbol}`
        : a.fred_series_id
        ? `FRED: ${a.fred_series_id}`
        : 'No provider symbol set';
      const eiaInfo = a.eia_series_id ? ` | EIA: ${a.eia_series_id}` : '';
      console.log(`  [${a.symbol}] ${a.name} — ${providerInfo}${eiaInfo}`);
    }
    console.log('');
  }

  // 3. Sanity checks
  const EXPECTED_TOTAL = 16;
  const EXPECTED_CLASSES = ['index', 'fx', 'rate', 'commodity'];
  let passed = true;

  if (assets.length !== EXPECTED_TOTAL) {
    console.error(`[FAIL] Expected ${EXPECTED_TOTAL} assets, got ${assets.length}`);
    passed = false;
  }

  for (const cls of EXPECTED_CLASSES) {
    if (!grouped[cls]) {
      console.error(`[FAIL] Missing asset_class: '${cls}'`);
      passed = false;
    }
  }

  const missingFinnhub = assets.filter(
    a => a.asset_class !== 'rate' && !a.finnhub_symbol
  );
  if (missingFinnhub.length > 0) {
    console.error('[FAIL] Non-rate assets missing finnhub_symbol:', missingFinnhub.map(a => a.symbol));
    passed = false;
  }

  const missingFred = assets.filter(
    a => a.asset_class === 'rate' && !a.fred_series_id
  );
  if (missingFred.length > 0) {
    console.error('[FAIL] Rate assets missing fred_series_id:', missingFred.map(a => a.symbol));
    passed = false;
  }

  // 4. Confirm write is blocked (RLS check)
  console.log('Checking RLS blocks anonymous writes...');
  const { error: writeError } = await supabase
    .from('assets')
    .insert({ symbol: 'TEST', name: 'Test Asset', asset_class: 'index' });

  if (writeError) {
    console.log('[OK] Anonymous write correctly blocked by RLS.\n');
  } else {
    console.error('[FAIL] Anonymous write was NOT blocked — RLS policy may be misconfigured.\n');
    passed = false;
  }

  if (passed) {
    console.log('All checks passed. Schema and seed data are verified.');
  } else {
    console.error('\nOne or more checks failed. Review the output above.');
    process.exit(1);
  }
}

verify();
