import { notFound } from 'next/navigation';
import { getCommodityDetail } from '@/lib/data/commodityDetail';
import CommodityDetailView from '@/components/commodities/CommodityDetailView';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ symbol: string }> | { symbol: string };
}

export default async function CommodityDetailPage({ params }: PageProps) {
  const resolved = params instanceof Promise ? await params : params;
  const symbol = resolved.symbol;

  const detail = await getCommodityDetail(symbol);

  if (!detail) {
    notFound();
  }

  return <CommodityDetailView commodity={detail} />;
}
