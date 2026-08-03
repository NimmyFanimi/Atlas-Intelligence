import 'dotenv/config';

async function main() {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) {
    console.error('MARKETAUX_API_KEY not found in environment');
    process.exit(1);
  }

  const url = `https://api.marketaux.com/v1/news/all?symbols=SPY,QQQ,GLD&filter_entities=true&language=en&limit=2&api_token=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  console.log(JSON.stringify(data, null, 2));
}

main();
