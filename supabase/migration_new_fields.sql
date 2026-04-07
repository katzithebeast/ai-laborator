-- Spusť v Supabase → SQL Editor → Run
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS similar_tools text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS best_for_roles text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS time_saved text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS aha_moment text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS onboarding_score int;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS ui_intuitive text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS output_quality text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS hallucinates text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS weaknesses text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS security_risks text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS limitations text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS recommended text;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS rating int;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS pricing text;
