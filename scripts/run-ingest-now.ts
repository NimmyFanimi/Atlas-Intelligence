// Throwaway runner for the market-snapshot ingestion + post-run verification.
// Run: npx tsx scripts/run-ingest-now.ts
// (Uses dynamic imports so .env.local is loaded before the supabase admin
// client — which reads env vars at module evaluation — is imported.)

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { ingestMarketSnapshots } = await import('../src/lib/cron/ingest-market-snapshots');
  const { supabaseAdmin } = await import('../src/lib/supabase/admin');

  console.log('=== ingestMarketSnapshots() ===');
  const results = await ingestMarketSnapshots();
  console.log(JSON.stringify(results, null, 2));

  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('assets')
    .select('id, symbol, name, asset_class');

  if (assetsError || !assets) {
    throw new Error(`Failed to load assets: ${assetsError?.message}`);
  }

  const commodityAssets = assets.filter((a: any) => a.asset_class === 'commodity');

  console.log('\n=== Newest snapshot per commodity asset ===');
  for (const asset of commodityAssets) {
    const { data: snap, error: snapErr } = await supabaseAdmin
      .from('market_snapshots')
      .select('price, change_pct, change_abs, metadata, timestamp')
      .eq('asset_id', asset.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (snapErr) {
      console.log(`\n${asset.symbol} (${asset.name}): no snapshot — ${snapErr.message}`);
      continue;
    }

    console.log(`\n${asset.symbol} (${asset.name}):`);
    console.log(`  price      = ${snap.price}`);
    console.log(`  change_pct = ${snap.change_pct}`);
    console.log(`  change_abs = ${snap.change_abs}`);
    console.log(`  source     = ${snap.metadata?.source}`);
    console.log(`  timestamp  = ${snap.timestamp}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
