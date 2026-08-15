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

  // Compute a fixed 7-day window starting from today (today through 6 days ahead)
  const windowDays = [];
  const baseDate = new Date();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setUTCDate(baseDate.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    
    // Group events that fall on this day
    const dayEvents = allEvents.filter(
      (event) => event.release_date === dateStr
    );
    
    windowDays.push({
      date: dateStr,
      events: dayEvents,
    });
  }

  let lastEventDayIndex = -1;
  for (let i = windowDays.length - 1; i >= 0; i--) {
    if (windowDays[i].events.length > 0) {
      lastEventDayIndex = i;
      break;
    }
  }

  const displayDays = lastEventDayIndex !== -1 
    ? windowDays.slice(0, lastEventDayIndex + 1)
    : windowDays;

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
