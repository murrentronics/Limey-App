-- Create a trigger to update video profiles when a profile is updated
CREATE OR REPLACE FUNCTION update_videos_on_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the profiles data in all videos for this user
  UPDATE videos
  SET profiles = jsonb_build_object(
    'username', NEW.username,
    'avatar_url', NEW.avatar_url
  )
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_videos_on_profile_change ON profiles;

-- Create the trigger
CREATE TRIGGER update_videos_on_profile_change
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.username IS DISTINCT FROM NEW.username OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url)
EXECUTE FUNCTION update_videos_on_profile_change();