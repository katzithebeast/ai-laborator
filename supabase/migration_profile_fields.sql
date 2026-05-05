-- Rozšíření profilu uživatele o nová pole

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

UPDATE profiles SET profile_completed = false
WHERE profile_completed IS NULL;
