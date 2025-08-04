-- Add missing columns to system_notifications table for comment notifications
ALTER TABLE system_notifications 
ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sent_to_username TEXT,
ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 1;

-- Create index for video_id for better performance
CREATE INDEX IF NOT EXISTS idx_system_notifications_video_id ON system_notifications(video_id);

-- Update RLS policies to allow comment notifications
-- The existing policies should work, but let's make sure inserts work for comment notifications
DROP POLICY IF EXISTS "System can insert notifications" ON system_notifications;
CREATE POLICY "System can insert notifications" ON system_notifications
  FOR INSERT WITH CHECK (true);

-- Create function to create comment notification
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  -- Get the commenter's username and video details
  DECLARE
    commenter_username TEXT;
    video_owner_id UUID;
  BEGIN
    -- Get commenter's username
    SELECT username INTO commenter_username
    FROM profiles
    WHERE user_id = NEW.user_id;
    
    -- Get video owner (only for top-level comments)
    IF NEW.parent_id IS NULL THEN
      SELECT user_id INTO video_owner_id
      FROM videos
      WHERE id = NEW.video_id;
      
      -- Only create notification if someone else commented (not the video owner)
      IF NEW.user_id != video_owner_id THEN
        -- Insert notification for the video owner
        INSERT INTO system_notifications (
          to_user_id,
          from_user_id,
          type,
          title,
          message,
          video_id
        ) VALUES (
          video_owner_id,
          NEW.user_id,
          'video_comment',
          'New comment on your video',
          '@' || COALESCE(commenter_username, 'Someone') || ' commented on your video',
          NEW.video_id
        );
      END IF;
    END IF;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create comment notifications
DROP TRIGGER IF EXISTS create_comment_notification_trigger ON comments;
CREATE TRIGGER create_comment_notification_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();