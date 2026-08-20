// EIA API v2 observation shape (single series row)
interface EIAObservation {
  period: string; // 'YYYY-MM-DD'
  value: string;  // Numeric string
  series: string;
  units?: string;
}

interface EIAResponse {
  response: {
    total: string;
    data: EIAObservation[];
  };
}

export interface EIAResult {
  value: number; // Latest available value (e.g. 84.77 for WTI spot)
  date: Date;    // Date the value was published
}

// EIA v2 route per series prefix. v1-style series IDs (PET.RWTC.D, NG.RNGWHHD.D)
// are `<prefix>.<code>.<frequency>`, which map to a v2 route + facet (short code):
//   PET. → petroleum/pri/spt (petroleum spot prices)
//   NG.  → natural-gas/pri/fut (natural gas futures AND Henry Hub spot)
const EIA_ROUTES: Record<string, string> = {
  PET: 'petroleum/pri/spt',
  NG: 'natural-gas/pri/fut',
};

export async function fetchEIAPrice(seriesId: string): Promise<EIAResult> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error('EIA_API_KEY is not set');

  // v2 facets use the short code (e.g. RWTC, RNGWHHD), not the full v1 series ID
  // (e.g. PET.RWTC.D returns zero rows), so split the v1-style ID into parts.
  const parts = seriesId.split('.');
  const prefix = parts[0];
  const facet = parts[1];

  if (!prefix || !facet) {
    throw new Error(`EIA [${seriesId}] has invalid series ID — expected <prefix>.<code>.<frequency> (e.g. PET.RWTC.D)`);
  }

  const route = EIA_ROUTES[prefix];
  if (!route) {
    throw new Error(`EIA [${seriesId}] has unsupported prefix '${prefix}' — no v2 route mapping`);
  }

  const url = `https://api.eia.gov/v2/${route}/data/?api_key=${apiKey}&frequency=daily&data[0]=value&facets[series][]=${encodeURIComponent(facet)}&sort[0][column]=period&sort[0][direction]=desc&length=1`;

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`EIA [${seriesId}] failed: HTTP ${res.status}`);
  }

  const data: EIAResponse = await res.json();

  if (!data.response?.data || data.response.data.length === 0) {
    throw new Error(`EIA [${seriesId}] returned no data for facet '${facet}'`);
  }

  const latest = data.response.data[0];

  const numericValue = parseFloat(latest.value);
  if (isNaN(numericValue)) {
    throw new Error(`EIA [${seriesId}] returned non-numeric value: '${latest.value}'`);
  }

  return {
    value: numericValue,
    date: new Date(latest.period),
  };
}
