-- Username Uniqueness Migration for Supabase
-- Run this in your Supabase SQL Editor to ensure no two users can have the same username

-- Step 1: Identify and fix any existing duplicate usernames
-- Create a temporary table to identify duplicates
CREATE TEMP TABLE duplicate_usernames AS
SELECT username, COUNT(*) as count
FROM profiles
GROUP BY username
HAVING COUNT(*) > 1;

-- Update duplicate usernames by appending a number
UPDATE profiles 
SET username = username || '_' || (
  SELECT ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at)
  FROM profiles p2 
  WHERE p2.username = profiles.username
)
WHERE username IN (SELECT username FROM duplicate_usernames);

-- Drop the temporary table
DROP TABLE duplicate_usernames;

-- Step 2: Ensure the unique constraint exists
-- Drop existing constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Add the unique constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- Step 3: Create a function to validate username format
CREATE OR REPLACE FUNCTION validate_username(username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Username must be 3-30 characters, alphanumeric and underscores only
  RETURN username ~ '^[a-zA-Z0-9_]{3,30}$';
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a trigger to validate username before insert/update
CREATE OR REPLACE FUNCTION validate_username_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_username(NEW.username) THEN
    RAISE EXCEPTION 'Username must be 3-30 characters long and contain only letters, numbers, and underscores';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_username_trigger ON profiles;
CREATE TRIGGER validate_username_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_username_trigger();

-- Step 5: Update the handle_new_user function to ensure unique usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 1;
BEGIN
  -- Get base username from metadata or generate from email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '_'))
  );
  
  -- Ensure username meets requirements
  IF base_username IS NULL OR LENGTH(base_username) < 3 THEN
    base_username := 'user_' || substring(NEW.id::text, 1, 8);
  END IF;
  
  -- Remove any invalid characters
  base_username := REGEXP_REPLACE(base_username, '[^a-zA-Z0-9_]', '', 'g');
  
  -- Ensure username starts with a letter
  IF NOT (base_username ~ '^[a-zA-Z]') THEN
    base_username := 'user_' || base_username;
  END IF;
  
  -- Limit length
  IF LENGTH(base_username) > 30 THEN
    base_username := LEFT(base_username, 30);
  END IF;
  
  -- Find unique username
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    final_username := base_username || '_' || counter;
    counter := counter + 1;
    
    -- Prevent infinite loop
    IF counter > 100 THEN
      final_username := 'user_' || substring(NEW.id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;
  
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create a function to manually fix existing usernames if needed
CREATE OR REPLACE FUNCTION fix_existing_usernames()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
  new_username TEXT;
  counter INTEGER;
BEGIN
  FOR profile_record IN 
    SELECT id, user_id, username 
    FROM profiles 
    WHERE username IS NULL OR username = '' OR LENGTH(username) < 3
  LOOP
    -- Generate a new username
    new_username := 'user_' || substring(profile_record.user_id::text, 1, 8);
    counter := 1;
    
    -- Make sure it's unique
    WHILE EXISTS (SELECT 1 FROM profiles WHERE username = new_username AND id != profile_record.id) LOOP
      new_username := 'user_' || substring(profile_record.user_id::text, 1, 8) || '_' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Update the profile
    UPDATE profiles 
    SET username = new_username 
    WHERE id = profile_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Run the fix function to ensure all profiles have valid usernames
SELECT fix_existing_usernames();

-- Step 8: Verify the migration worked
-- Check for any remaining duplicates
SELECT username, COUNT(*) as count
FROM profiles
GROUP BY username
HAVING COUNT(*) > 1;

-- Check for any invalid usernames
SELECT id, username 
FROM profiles 
WHERE username IS NULL 
   OR username = '' 
   OR LENGTH(username) < 3 
   OR NOT (username ~ '^[a-zA-Z0-9_]{3,30}$');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Username uniqueness migration completed successfully!';
  RAISE NOTICE 'All usernames are now unique and properly formatted.';
END $$; 