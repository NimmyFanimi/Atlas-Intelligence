-- 1. Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,       -- Clean internal symbol (e.g., SPX, EURUSD, WTI)
  name text NOT NULL,                -- Human readable name
  asset_class text NOT NULL,         -- 'index', 'fx', 'rate', 'commodity'
  finnhub_symbol text,               -- For Quotes / News
  fred_series_id text,               -- For US Treasury / FRED macro data
  eia_series_id text,                -- For EIA energy data
  created_at timestamptz DEFAULT now()
);

-- 2. Create market_snapshots table
CREATE TABLE IF NOT EXISTS market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  price numeric NOT NULL,
  change_pct numeric,                -- 24h % change
  change_abs numeric,                -- 24h absolute change
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Create composite index to optimize the "latest snapshot per asset" query
CREATE INDEX IF NOT EXISTS idx_market_snapshots_asset_time ON market_snapshots(asset_id, timestamp DESC);

-- 3.5 Create news_articles table
CREATE TABLE IF NOT EXISTS news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketaux_uuid text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  url text NOT NULL,
  source text,
  published_at timestamptz NOT NULL,
  sentiment_score numeric,
  matched_asset_ids uuid[] DEFAULT '{}'::uuid[],
  is_macro boolean DEFAULT false,
  ai_analysis jsonb,
  ai_model_used text,
  -- image_url added after initial table creation
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- GIN index for asset lookups on matched_asset_ids
CREATE INDEX IF NOT EXISTS idx_news_articles_matched_asset_ids ON news_articles USING gin (matched_asset_ids);

-- Partial index for the phase-2 AI processing queue (rows where ai_analysis IS NULL)
CREATE INDEX IF NOT EXISTS idx_news_articles_ai_analysis_null ON news_articles(created_at) WHERE ai_analysis IS NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- 5. Create read-only public RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND policyname = 'Allow public read access on assets'
  ) THEN
    CREATE POLICY "Allow public read access on assets" ON assets FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'market_snapshots' AND policyname = 'Allow public read access on market_snapshots'
  ) THEN
    CREATE POLICY "Allow public read access on market_snapshots" ON market_snapshots FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'news_articles' AND policyname = 'Allow public read access on news_articles'
  ) THEN
    CREATE POLICY "Allow public read access on news_articles" ON news_articles FOR SELECT USING (true);
  END IF;
END
$$;

-- 6. Pre-Seed Data for the 16-Asset Watchlist
INSERT INTO assets (symbol, name, asset_class, finnhub_symbol, fred_series_id, eia_series_id) VALUES
-- Indices (Using liquid US ETF Proxies for live quotes)
('SPX',     'S&P 500',       'index', 'SPY', NULL, NULL),
('NDX',     'Nasdaq 100',    'index', 'QQQ', NULL, NULL),
('DJI',     'Dow Jones',     'index', 'DIA', NULL, NULL),
('FTSE',    'FTSE 100',      'index', 'EWU', NULL, NULL),
('STOXX50', 'Euro Stoxx 50', 'index', 'FEZ', NULL, NULL),

-- FX (Using Currency ETF Proxies for live quotes)
('EURUSD',  'EUR/USD',       'fx',    'FXE', NULL, NULL),
('GBPUSD',  'GBP/USD',       'fx',    'FXB', NULL, NULL),
('USDJPY',  'USD/JPY',       'fx',    'FXY', NULL, NULL),
('DXY',     'US Dollar Idx', 'fx',    'UUP', NULL, NULL),

-- Rates (FRED, daily updates)
('US10Y',   'US 10Y Yield',  'rate',  NULL,  'DGS10', NULL),
('US2Y',    'US 2Y Yield',   'rate',  NULL,  'DGS2',  NULL),

-- Commodities (Finnhub ETFs for live, EIA for fundamentals)
('WTI',     'WTI Crude',     'commodity', 'USO',  NULL, 'PET.RWTC.D'),
('BRENT',   'Brent Crude',   'commodity', 'BNO',  NULL, 'PET.RBRTE.D'),
('GOLD',    'Gold',          'commodity', 'GLD',  NULL, NULL),
('NATGAS',  'Natural Gas',   'commodity', 'UNG',  NULL, 'NG.RNGC1.D'),
('COPPER',  'Copper',        'commodity', 'CPER', NULL, NULL)
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  asset_class = EXCLUDED.asset_class,
  finnhub_symbol = EXCLUDED.finnhub_symbol,
  fred_series_id = EXCLUDED.fred_series_id,
  eia_series_id = EXCLUDED.eia_series_id;
