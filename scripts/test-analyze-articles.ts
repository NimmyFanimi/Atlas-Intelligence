import 'dotenv/config';
import { analyzeUnprocessedArticles } from '../src/lib/news-analysis';

async function main() {
  const result = await analyzeUnprocessedArticles();
  console.log('Analysis result:', result);
}

main().catch((err) => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
