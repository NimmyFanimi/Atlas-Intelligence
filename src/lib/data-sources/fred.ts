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

  const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${releaseId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`FRED release ${releaseId} dates failed: HTTP ${res.status}`);
  }

  const data: FredReleaseDatesResponse = await res.json();

  const today = new Date().toISOString().slice(0, 10);

  const entry = (data.release_dates || []).find(item => item.date >= today);

  if (!entry) return null;

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

  const res = await fetch(url, { cache: 'no-store' });

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
