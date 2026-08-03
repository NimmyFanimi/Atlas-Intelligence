import 'dotenv/config';
import { ingestRawArticles } from '../src/lib/news-ingestion';

async function main() {
  const result = await ingestRawArticles();
  console.log('Ingestion result:', result);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
