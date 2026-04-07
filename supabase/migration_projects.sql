-- Spusť v Supabase → SQL Editor → Run
CREATE TABLE IF NOT EXISTS projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text default 'draft',
  client text,
  team text,
  duration text,
  tools_used text,
  project_goal text,
  what_worked text,
  what_failed text,
  lessons_learned text,
  avoid_next_time text,
  process_that_worked text,
  ai_contribution text,
  tool_ratings jsonb default '[]',
  overall_rating int,
  would_repeat text,
  author_id uuid references auth.users(id),
  author_name text,
  chat_history jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update projects" ON projects FOR UPDATE TO authenticated USING (true);
