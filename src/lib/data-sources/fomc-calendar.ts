// lib/data-sources/fomc-calendar.ts
//
// Fetches the upcoming FOMC meeting schedule from an unofficial third-party
// mirror (the-calendar.net). This is NOT an official Federal Reserve source.
//
// The API returns Day 1 + Day 2 pairs for each meeting. Only Day 2 is
// surfaced — that's when the rate decision is announced (2:00 PM ET) and
// the press conference is held. Day 1 is the internal deliberation day with
// no public-facing event.
//
// Failure handling: fetch errors are caught and logged by the caller
// (calendar-ingestion.ts). This function does NOT throw on network/parse
// errors — it returns an empty array so other calendar sources (CPI/NFP/
// GDP/PCE via FRED) continue ingesting normally.

const FOMC_CALENDAR_URL = 'https://the-calendar.net/api/finance/fomc/2026.json';

export interface FomcMeeting {
  date: string;       // 'YYYY-MM-DD'
  name: string;       // e.g. "FOMC Meeting Day 2 (Sep)"
}

/**
 * Fetch the FOMC meeting calendar and return only upcoming Day 2
 * (rate-decision) meetings. Returns an empty array on any failure.
 */
export async function fetchUpcomingFomcMeetings(): Promise<FomcMeeting[]> {
  let res: Response;
  try {
    res = await fetch(FOMC_CALENDAR_URL, { cache: 'no-store' });
  } catch {
    return [];
  }

  if (!res.ok) {
    return [];
  }

  let data: { meetings?: { name: string; date: string; note?: string }[] };
  try {
    data = await res.json();
  } catch {
    return [];
  }

  if (!data.meetings || !Array.isArray(data.meetings)) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);

  return data.meetings
    .filter((m) => m.name.includes('Day 2') && m.date >= today)
    .map((m) => ({ date: m.date, name: m.name }));
}
