import { getCommoditiesOverview } from '@/lib/data/commodities';
import CommoditiesOverview from '@/components/commodities/CommoditiesOverview';

export const revalidate = 300;

export default async function CommoditiesPage() {
  const commodities = await getCommoditiesOverview();
  return <CommoditiesOverview commodities={commodities} />;
}