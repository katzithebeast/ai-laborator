-- Globální nastavení aplikace
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Výchozí revizní interval: 90 dní
INSERT INTO app_settings (key, value)
VALUES ('revision_days', '90')
ON CONFLICT (key) DO NOTHING;

-- Nové sloupce v use_cases pro sledování revize
ALTER TABLE use_cases
ADD COLUMN IF NOT EXISTS published_at timestamptz,
ADD COLUMN IF NOT EXISTS revision_due_at timestamptz,
ADD COLUMN IF NOT EXISTS revision_status text DEFAULT 'ok';
-- revision_status: 'ok' | 'due'

-- RLS pro app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings"  ON app_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can update settings" ON app_settings FOR ALL USING (true);
