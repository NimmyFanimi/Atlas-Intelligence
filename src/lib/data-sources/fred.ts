// FRED API observation shape
interface FredObservation {
  date: string;  // 'YYYY-MM-DD'
  value: string; // Numeric string, or '.' if missing
}

interface FredResponse {
  observations: FredObservation[];
}

export interface FredResult {
  value: number; // Latest available value (e.g. 4.25 for a yield)
  date: Date;    // Date the value was published
}

interface FredReleaseDate {
  release_id: number;
  release_name: string;
  date: string;
}

interface FredReleaseDatesResponse {
  release_dates: FredReleaseDate[];
}

export interface UpcomingRelease {
  releaseId: string;
  releaseName: string;
  date: string;
}

export async function fetchNextReleaseDate(releaseId: string): Promise<UpcomingRelease | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not set');

  // FRED's fred/release/dates endpoint returns a release's full historical
  // date list. Use sort_order=desc with a small limit: the newest entries are
  // returned first, which safely captures any future-dated entries near today
  // without needing a limit large enough to walk the entire history. A fixed
  // ascending limit (e.g. 1000) would eventually be insufficient for releases
  // with very large histories (e.g. FOMC Press Release, release_id 101, has
  // 3748 dated entries), so we must not rely on that.
  const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${releaseId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=20`;

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });

  if (!res.ok) {
    throw new Error(`FRED release ${releaseId} dates failed: HTTP ${res.status}`);
  }

  const data: FredReleaseDatesResponse = await res.json();

  const today = new Date().toISOString().slice(0, 10);

  // Filter down to only future-dated (date >= today) entries. Because the
  // response is sorted descending (newest first), this filtered array stays in
  // descending order, so the correct "next upcoming" date is the LAST entry —
  // the earliest (soonest) of the future-dated ones — not the first.
  const upcoming = (data.release_dates || []).filter(item => item.date >= today);

  if (upcoming.length === 0) return null;

  const entry = upcoming[upcoming.length - 1];

  return {
    releaseId: String(entry.release_id),
    releaseName: entry.release_name,
    date: entry.date,
  };
}

export async function fetchLatestRate(seriesId: string): Promise<FredResult> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not set');

  // Fetch the last 5 observations — takes the most recent non-missing value
  // (FRED sometimes publishes '.' for weekends/holidays before the real value arrives)
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });

  if (!res.ok) {
    throw new Error(`FRED [${seriesId}] failed: HTTP ${res.status}`);
  }

  const data: FredResponse = await res.json();

  if (!data.observations || data.observations.length === 0) {
    throw new Error(`FRED [${seriesId}] returned no observations`);
  }

  // Find the most recent observation with an actual numeric value
  const latest = data.observations.find(obs => obs.value !== '.');

  if (!latest) {
    throw new Error(`FRED [${seriesId}] has no non-missing observations in the last 5 entries`);
  }

  const numericValue = parseFloat(latest.value);
  if (isNaN(numericValue)) {
    throw new Error(`FRED [${seriesId}] returned non-numeric value: '${latest.value}'`);
  }

  return {
    value: numericValue,
    date: new Date(latest.date),
  };
}
