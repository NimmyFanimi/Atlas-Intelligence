// This is a curated V1 allowlist of FRED release_ids to track for the
// Economic Calendar module, since FRED has no importance/category metadata
// of its own. ISM/PMI is intentionally excluded because ISM does not publish
// through FRED (source limitation, not a budget constraint), logged as PLANNED
// for a future non-FRED source if ever added.

export interface TrackedRelease {
  releaseId: string;
  eventName: string;
  category: 'inflation' | 'employment' | 'rates' | 'growth' | 'manufacturing';
  importance: 'high' | 'medium' | 'low';
  country: string;
}

export const TRACKED_RELEASES: TrackedRelease[] = [
  { releaseId: '10',  eventName: 'US CPI (Consumer Price Index)',    category: 'inflation',  importance: 'high', country: 'US' },
  { releaseId: '50',  eventName: 'US Employment Situation (NFP)',     category: 'employment', importance: 'high', country: 'US' },
  { releaseId: '53',  eventName: 'US GDP (Gross Domestic Product)',   category: 'growth',     importance: 'high', country: 'US' },
  { releaseId: '54',  eventName: 'US Personal Income & Outlays (PCE)', category: 'inflation', importance: 'high', country: 'US' },
  { releaseId: '101', eventName: 'FOMC Press Release',                category: 'rates',      importance: 'high', country: 'US' },
];
