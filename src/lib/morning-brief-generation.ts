import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMarketsDashboard } from '@/lib/data/markets';
import type { AssetWithSnapshot } from '@/lib/data/markets';

const GEMINI_MODEL = 'gemini-3.6-flash';
const NEWS_WINDOW_HOURS = 24;
const CALENDAR_LOOKAHEAD_DAYS = 3;
const TOP_MOVERS_COUNT = 3;
const MAX_NEWS_ARTICLES = 8;

interface MoverData {
  symbol: string;
  name: string;
  change_pct: number;
}

interface MoversData {
  gainers: MoverData[];
  losers: MoverData[];
}

interface NewsArticleBrief {
  title: string;
  description: string | null;
  published_at: string;
}

interface CalendarEventBrief {
  event_name: string;
  category: string;
  importance: string;
  release_date: string;
}

interface MorningBriefContext {
  movers: MoversData;
  news: NewsArticleBrief[];
  calendarEvents: CalendarEventBrief[];
}

function deriveMovers(assets: AssetWithSnapshot[]): MoversData {
  const movers: MoverData[] = [];
  for (const asset of assets) {
    const pct = asset.latest?.change_pct;
    if (pct === null || pct === undefined || isNaN(pct)) continue;
    movers.push({ symbol: asset.symbol, name: asset.name, change_pct: pct });
  }

  const sorted = [...movers].sort((a, b) => b.change_pct - a.change_pct);

  return {
    gainers: sorted.slice(0, TOP_MOVERS_COUNT),
    losers: sorted.slice(-TOP_MOVERS_COUNT).reverse(),
  };
}

async function fetchRecentMacroNews(): Promise<NewsArticleBrief[]> {
  const since = new Date(
    Date.now() - NEWS_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from('news_articles')
    .select('title, description, published_at')
    .gte('published_at', since)
    .eq('is_macro', true)
    .order('published_at', { ascending: false })
    .limit(MAX_NEWS_ARTICLES);

  if (error) {
    throw new Error(`Failed to load macro news: ${error.message}`);
  }

  return (data || []) as NewsArticleBrief[];
}

async function fetchUpcomingCalendarEvents(
  briefDate: string,
  windowEndDate: string
): Promise<CalendarEventBrief[]> {
  const { data, error } = await supabaseAdmin
    .from('calendar_events')
    .select('event_name, category, importance, release_date')
    .gte('release_date', briefDate)
    .lte('release_date', windowEndDate)
    .order('release_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load calendar events: ${error.message}`);
  }

  return (data || []) as CalendarEventBrief[];
}

function buildMorningBriefPrompt(context: MorningBriefContext): string {
  const moversLines = [
    'Top gainers:',
    ...context.movers.gainers.map(
      (m) => `- ${m.symbol} (${m.name}): ${m.change_pct.toFixed(2)}%`
    ),
    'Top losers:',
    ...context.movers.losers.map(
      (m) => `- ${m.symbol} (${m.name}): ${m.change_pct.toFixed(2)}%`
    ),
  ].join('\n');

  const newsLines =
    context.news.length > 0
      ? 'Recent macro news (past 24 hours, most recent first):\n' +
        context.news
          .map(
            (a) =>
              `- ${a.published_at}: ${a.title}${a.description ? ` -- ${a.description}` : ''}`
          )
          .join('\n')
      : 'Recent macro news: none available.';

  const calendarLines =
    context.calendarEvents.length > 0
      ? 'Upcoming economic calendar events (next 3 days):\n' +
        context.calendarEvents
          .map(
            (e) =>
              `- ${e.release_date} | ${e.event_name} | category: ${e.category} | importance: ${e.importance}`
          )
          .join('\n')
      : 'Upcoming economic calendar events: none available.';

  return `Write a 200-300 word morning market briefing in a professional, desk-note tone for a Sales & Trading audience.

The briefing is an analytical desk note written FOR a reader, not a message performed at a trading desk. Write in a neutral, third-person register that describes what happened in the market and why it matters. Do not perform the role of a person addressing colleagues:

- Do not address a "team" or "desk" directly. No "Good morning team", no "reach out to the desk", no second-person audience framing such as "you'll note" or "for those watching the tape".
- Do not include any closing sign-off line that implies the reader should contact someone for more information (no "please reach out to the desk", no "feel free to ping us", no "reach out for details").
- Do not sign the note or add a signature line of any kind; attribution is appended by the publisher, not written by you.

For example, prefer "Risk sentiment is off to a cautious start this morning..." over "Good morning team, risk sentiment is...". Always produce the first style.

Output must be plain prose only and contain no markdown syntax of any kind: no bold (**text**), no italics, no bullet points, no numbered lists, no headers, and no asterisks used as list markers. Write flowing narrative paragraphs separated by blank lines only. Do not use subsection headings and do not include any bulleted "takeaways" or "summary" section.

Requirements:
- Reference the provided top movers naturally in the narrative.
- Reference the provided recent macro news if relevant.
- CRITICALLY: only mention upcoming economic calendar events if the provided calendar event list is non-empty. If it is empty, do not reference "today's calendar" and do not invent any economic events; simply omit any calendar-related commentary entirely.
- Do not fabricate any data not provided in the context below.

Context:

${moversLines}

${newsLines}

${calendarLines}

Write the briefing now.`;
}

function isRetryableGeminiError(status: number | null): boolean {
  if (status === null) {
    return true;
  }
  if (status === 429) {
    return true;
  }
  if (status >= 500 && status <= 599) {
    return true;
  }
  return false;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [2000, 4000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isLastAttempt && isRetryableGeminiError(null)) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1];
        console.warn(
          `callGemini: attempt ${attempt} failed with network error: ${message}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err instanceof Error ? err : new Error(message);
    }

    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`Gemini call failed: ${res.status} ${body}`);
      if (!isLastAttempt && isRetryableGeminiError(res.status)) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1];
        console.warn(
          `callGemini: attempt ${attempt} failed with status ${res.status}: ${body}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawText !== 'string') {
      throw new Error(
        `Gemini response had unexpected shape: ${JSON.stringify(data)}`
      );
    }

    return rawText.trim();
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error('Gemini call failed: retries exhausted without a result');
}

export async function generateMorningBrief(): Promise<{
  success: boolean;
  briefDate: string;
  error?: string;
}> {
  const now = new Date();
  const briefDate = now.toISOString().slice(0, 10);
  const windowEndDate = new Date(
    now.getTime() + CALENDAR_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  try {
    const dashboard = await getMarketsDashboard();
    const movers = deriveMovers(dashboard.assets);
    const news = await fetchRecentMacroNews();
    const calendarEvents = await fetchUpcomingCalendarEvents(
      briefDate,
      windowEndDate
    );

    const prompt = buildMorningBriefPrompt({ movers, news, calendarEvents });

    const generated = await callGemini(prompt);
    const content = `${generated}\n\n- Atlas`;

    const { error: upsertError } = await supabaseAdmin
      .from('morning_briefs')
      .upsert(
        {
          brief_date: briefDate,
          content,
          movers_data: movers,
          ai_model_used: GEMINI_MODEL,
        },
        { onConflict: 'brief_date' }
      );

    if (upsertError) {
      return {
        success: false,
        briefDate,
        error: `Failed to save morning brief: ${upsertError.message}`,
      };
    }

    return { success: true, briefDate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('morning-brief-generation: failed to generate brief:', message);
    return { success: false, briefDate, error: message };
  }
}
