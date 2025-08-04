-- This SQL script will create a trigger to update all videos when a profile is updated

-- Create a function to get the latest profile data for a user
CREATE OR REPLACE FUNCTION get_latest_profile_data(user_uuid UUID)
RETURNS TABLE (
  username TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.username,
    p.avatar_url
  FROM 
    profiles p
  WHERE 
    p.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_latest_profile_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_profile_data(UUID) TO anon;

-- Make sure profiles table is included in the real-time publication
BEGIN;
  -- Check if profiles table is already in the publication
  DO $$
  DECLARE
    table_exists BOOLEAN;
  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
      -- Add profiles table to the existing publication
      ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
      RAISE NOTICE 'Added profiles table to supabase_realtime publication';
    ELSE
      RAISE NOTICE 'profiles table is already in supabase_realtime publication';
    END IF;
  END $$;
COMMIT;

-- Verify the trigger was created
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'update_videos_on_profile_change';

-- Instead of updating the videos table directly, let's create a view that joins videos and profiles
CREATE OR REPLACE VIEW videos_with_profiles AS
SELECT 
  v.*,
  p.username,
  p.avatar_url
FROM 
  videos v
JOIN 
  profiles p ON v.user_id = p.user_id;

-- Grant access to the view
GRANT SELECT ON videos_with_profiles TO authenticated;
GRANT SELECT ON videos_with_profiles TO anon;