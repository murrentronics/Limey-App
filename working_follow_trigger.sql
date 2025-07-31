-- Create working follow notification trigger

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS create_follow_notification_trigger ON follows;
DROP FUNCTION IF EXISTS create_follow_notification();

-- Create the function to create follow notifications
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
DECLARE
  follower_username TEXT;
BEGIN
  -- Get the follower's username from profiles
  SELECT username INTO follower_username
  FROM profiles
  WHERE user_id = NEW.follower_id;
  
  -- Insert notification for the user being followed
  INSERT INTO system_notifications (
    to_user_id,
    from_user_id,
    type,
    title,
    message
  ) VALUES (
    NEW.following_id,
    NEW.follower_id,
    'follow',
    'New Follower',
    COALESCE(follower_username, 'Someone') || ' started following you'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER create_follow_notification_trigger
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();

-- Test the trigger by simulating a follow (using existing user IDs from your follows table)
-- This will create a test notification
INSERT INTO follows (follower_id, following_id)
VALUES (
  '6ebb17b2-7822-4517-9ddd-c34d59fcbf2a',  -- follower
  '6360d3fb-7deb-4850-9a70-9a6d45a07220'   -- being followed
);

-- Check if the notification was created
SELECT 'Trigger test result:' as result;
SELECT * FROM system_notifications WHERE type = 'follow' ORDER BY created_at DESC LIMIT 1;