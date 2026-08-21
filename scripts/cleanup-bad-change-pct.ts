// One-time cleanup: delete stale market_snapshots rows for commodity symbols
// whose change_pct is wildly outside a plausible commodity move (|change_pct| > 100%),
// left over from the transition period before the source-scoped change_pct fix.
//
// Run (dry run, reports only):  npx tsx scripts/cleanup-bad-change-pct.ts --dry-run
// Run (delete):                  npx tsx scripts/cleanup-bad-change-pct.ts
// (Uses dynamic imports so .env.local is loaded before the supabase admin
// client — which reads env vars at module evaluation — is imported.)

import { config } from 'dotenv';
config({ path: '.env.local' });

const TARGET_SYMBOLS = ['WTI', 'BRENT', 'NATGAS', 'GOLD', 'COPPER'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { supabaseAdmin } = await import('../src/lib/supabase/admin');

  // 1. Resolve target asset ids
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol')
    .in('symbol', TARGET_SYMBOLS);

  if (assetsError || !assets) {
    throw new Error(`Failed to load assets: ${assetsError?.message}`);
  }

  const assetIds = assets.map((a: any) => a.id);
  if (assetIds.length !== TARGET_SYMBOLS.length) {
    throw new Error(
      `Expected ${TARGET_SYMBOLS.length} target assets, resolved ${assets.length}: ${assets.map((a: any) => a.symbol).join(', ')}`
    );
  }

  // 2. Find bad rows: |change_pct| > 100 (null change_pct excluded by the gt/lt filters)
  const { data: badRows, error: badRowsError } = await supabaseAdmin
    .from('market_snapshots')
    .select('id, asset_id, change_pct, timestamp')
    .in('asset_id', assetIds)
    .or('change_pct.gt.100,change_pct.lt.-100')
    .order('timestamp', { ascending: true });

  if (badRowsError) {
    throw new Error(`Failed to query bad rows: ${badRowsError.message}`);
  }

  if (!badRows || badRows.length === 0) {
    console.log('No rows matched (|change_pct| > 100 for WTI/BRENT/NATGAS/GOLD/COPPER). Nothing to delete.');
    return;
  }

  const symbolById = new Map(assets.map((a: any) => [a.id, a.symbol]));

  console.log(`=== Found ${badRows.length} bad rows ===`);
  for (const row of badRows) {
    console.log(
      `${row.id} | ${symbolById.get(row.asset_id)} | change_pct=${row.change_pct} | timestamp=${row.timestamp}`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no rows deleted.');
    return;
  }

  // 3. Delete exactly these rows, by id
  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from('market_snapshots')
    .delete()
    .in('id', badRows.map((r: any) => r.id))
    .select('id');

  if (deleteError) {
    throw new Error(`Delete failed: ${deleteError.message}`);
  }

  console.log(`\nDeleted ${deleted?.length ?? 0}/${badRows.length} rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });