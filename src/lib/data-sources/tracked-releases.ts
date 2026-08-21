// This is a curated V1 allowlist of FRED release_ids to track for the
// Economic Calendar module, since FRED has no importance/category metadata
// of its own. ISM/PMI is intentionally excluded because ISM does not publish
// through FRED (source limitation, not a budget constraint), logged as PLANNED
// for a future non-FRED source if ever added.

export interface TrackedRelease {
  releaseId: string;
  primaryName: string;
  secondaryName: string;
  category: 'inflation' | 'employment' | 'rates' | 'growth' | 'manufacturing';
  importance: 'high' | 'medium' | 'low';
  country: string;
}

export const TRACKED_RELEASES: TrackedRelease[] = [
  { releaseId: '10',  primaryName: 'US CPI',  secondaryName: 'Consumer Price Index',      category: 'inflation',  importance: 'high', country: 'US' },
  { releaseId: '50',  primaryName: 'US NFP',  secondaryName: 'Employment Situation',       category: 'employment', importance: 'high', country: 'US' },
  { releaseId: '53',  primaryName: 'US GDP',  secondaryName: 'Gross Domestic Product',     category: 'growth',     importance: 'high', country: 'US' },
  { releaseId: '54',  primaryName: 'US PCE',  secondaryName: 'Personal Income & Outlays',  category: 'inflation',  importance: 'high', country: 'US' },
];
