-- NÁSTROJE
create table if not exists tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text,
  website_url text,
  description text,
  category text,
  tags text[] default '{}',
  status text default 'new',       -- new | claimed | in_progress | completed | archived
  legit_score int default 0,
  fit_score int default 0,
  novelty_score int default 0,
  source text default 'manual',    -- manual | rss | discovery
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- USE CASY
create table if not exists use_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tool_id uuid references tools(id),
  tool_name text,
  team text,
  problem text,
  solution text,
  benefits text,
  risks text,
  effort text,                      -- low | medium | high
  impact text,                      -- low | medium | high
  status text default 'draft',      -- draft | review | published | archived
  confidence_score int default 0,
  tags text[] default '{}',
  author_id uuid references auth.users(id),
  author_name text,
  chat_history jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROFILY UŽIVATELŮ
create table if not exists profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text default 'analyst',      -- analyst | admin | viewer
  team text,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table tools enable row level security;
alter table use_cases enable row level security;
alter table profiles enable row level security;

create policy "read tools" on tools for select to authenticated using (true);
create policy "insert tools" on tools for insert to authenticated with check (true);
create policy "update tools" on tools for update to authenticated using (true);

create policy "read use_cases" on use_cases for select to authenticated using (true);
create policy "insert use_cases" on use_cases for insert to authenticated with check (true);
create policy "update use_cases" on use_cases for update to authenticated using (true);

create policy "read profiles" on profiles for select to authenticated using (true);
create policy "own profile insert" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on profiles for update to authenticated using (auth.uid() = id);

-- AUTO-CREATE PROFIL PŘI REGISTRACI
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- SEED DEMO DATA
insert into tools (name, vendor, website_url, description, category, tags, status, legit_score, fit_score, novelty_score, source)
values
  ('Notion AI', 'Notion', 'https://notion.so/product/ai', 'AI asistence pro dokumenty, databáze a workflow.', 'productivity', array['productivity','docs','ai'], 'new', 70, 50, 40, 'seed'),
  ('Zapier AI Actions', 'Zapier', 'https://zapier.com', 'Automatizace a orchestrace napříč nástroji.', 'automation', array['automation','workflow'], 'new', 70, 50, 41, 'seed'),
  ('Perplexity AI', 'Perplexity', 'https://perplexity.ai', 'AI vyhledávač s citacemi zdrojů v reálném čase.', 'research', array['search','research'], 'new', 85, 60, 55, 'seed');
