import { supabaseAdmin } from '@/lib/supabase/admin';
import { TRACKED_RELEASES } from '@/lib/data-sources/tracked-releases';
import CalendarView from '@/components/calendar/CalendarView';

export const revalidate = 300;

export default async function CalendarPage() {
  const { data: events, error } = await supabaseAdmin
    .from('calendar_events')
    .select('*')
    .order('release_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load calendar events: ${error.message}`);
  }

  const allEvents = events ?? [];

  // Build a 7-day window starting from today, then keep only days that have events.
  const windowDays = [];
  const baseDate = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setUTCDate(baseDate.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayEvents = allEvents.filter(
      (event) => event.release_date === dateStr
    );

    windowDays.push({
      date: dateStr,
      events: dayEvents,
    });
  }

  const displayDays = windowDays.filter((d) => d.events.length > 0);

  // Next event: the single earliest-dated row in calendar_events (if any exist)
  const nextEvent = allEvents[0] || null;

  // TBD tracked releases: those with NO row in calendar_events at all
  const tbdReleases = TRACKED_RELEASES.filter(
    (tracked) => !allEvents.some((event) => event.fred_release_id === tracked.releaseId)
  );

  return (
    <CalendarView
      groupedDays={displayDays}
      tbdReleases={tbdReleases}
      nextEvent={nextEvent}
    />
  );
}
