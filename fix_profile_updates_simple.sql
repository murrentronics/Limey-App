-- Remove the trigger that's causing problems
DROP TRIGGER IF EXISTS update_videos_on_profile_change ON profiles;

-- Drop the function as well
DROP FUNCTION IF EXISTS update_videos_on_profile_change();

-- Check if we added a profiles column and remove it if needed
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'videos'
    AND column_name = 'profiles'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Remove the profiles column if we added it
    EXECUTE 'ALTER TABLE videos DROP COLUMN IF EXISTS profiles';
    RAISE NOTICE 'Removed profiles column from videos table';
  ELSE
    RAISE NOTICE 'profiles column does not exist in videos table';
  END IF;
END $$;