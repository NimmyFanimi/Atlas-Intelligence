import { getNewsFeed } from '@/lib/news';
import NewsFeed from '@/components/news/NewsFeed';

export const revalidate = 300;

export default async function NewsEnginePage() {
  const data = await getNewsFeed();
  return <NewsFeed data={data} />;
}