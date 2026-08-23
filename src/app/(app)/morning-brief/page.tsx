import { supabaseAdmin } from '@/lib/supabase/admin';
import MorningBriefView from '@/components/morning-brief/MorningBriefView';

export const revalidate = 300;

export interface MoverEntry {
  symbol: string;
  name: string;
  change_pct: number;
}

interface MorningBriefRow {
  brief_date: string;
  content: string;
  movers_data: {
    gainers: MoverEntry[];
    losers: MoverEntry[];
  };
  generated_at: string;
}

interface TodayEventRow {
  event_name: string;
  release_time: string | null;
  release_date: string;
}

export default async function MorningBriefPage() {
  const { data: briefs, error } = await supabaseAdmin
    .from('morning_briefs')
    .select('brief_date, content, movers_data, generated_at')
    .order('brief_date', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load morning brief: ${error.message}`);
  }

  const brief: MorningBriefRow | null = (briefs && briefs[0]) ?? null;

  // Reference date = the brief's own day when one exists, otherwise today (UTC).
  // Mirrors the 3-day lookahead window used by generateMorningBrief().
  const referenceDate = brief ? String(brief.brief_date) : new Date().toISOString().slice(0, 10);
  const windowEndDate = new Date(
    new Date(`${referenceDate}T00:00:00Z`).getTime() + 3 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const { data: windowEvents, error: eventsError } = await supabaseAdmin
    .from('calendar_events')
    .select('event_name, release_time, release_date')
    .gte('release_date', referenceDate)
    .lte('release_date', windowEndDate)
    .order('release_time', { ascending: true });

  if (eventsError) {
    throw new Error(`Failed to load calendar events: ${eventsError.message}`);
  }

  const todayEvents: TodayEventRow[] = (windowEvents ?? []).filter(
    (event) => event.release_date === referenceDate
  );

  return (
    <MorningBriefView
      brief={brief}
      todayEvents={todayEvents}
      referenceDate={referenceDate}
    />
  );
}