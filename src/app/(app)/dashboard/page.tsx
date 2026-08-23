import { getMarketsDashboard } from '@/lib/data/markets';
import MarketsDashboard from '@/components/markets/MarketsDashboard';

export const revalidate = 300;

export default async function MarketsPage() {
  const data = await getMarketsDashboard();
  return <MarketsDashboard data={data} />;
}
