-- RBAC migration: 4 role tiers

-- Drop and recreate the role constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('super_admin', 'admin', 'analyst', 'viewer'));

-- Add email column to profiles (for admin management)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email text;

-- Set super_admin
UPDATE profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'katzithebeast@gmail.com');

-- Backfill email from auth.users into profiles
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- Auto-role trigger for new registrations
CREATE OR REPLACE FUNCTION handle_new_user_role()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    CASE
      WHEN NEW.email = 'katzithebeast@gmail.com' THEN 'super_admin'
      WHEN NEW.email LIKE '%@wexia.digital' THEN 'admin'
      ELSE 'viewer'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    role = CASE
      WHEN NEW.email = 'katzithebeast@gmail.com' THEN 'super_admin'
      WHEN NEW.email LIKE '%@wexia.digital' THEN 'admin'
      ELSE profiles.role
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_role();
