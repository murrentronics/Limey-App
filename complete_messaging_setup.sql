-- Complete messaging and notifications setup

-- Drop existing triggers and functions first
DROP TRIGGER IF EXISTS create_follow_notification_trigger ON follows;
DROP TRIGGER IF EXISTS remove_follow_notification_trigger ON follows;
DROP FUNCTION IF EXISTS create_follow_notification();
DROP FUNCTION IF EXISTS remove_follow_notification();
DROP FUNCTION IF EXISTS mark_messages_as_read(UUID, UUID);

-- Drop and recreate system_notifications table
DROP TABLE IF EXISTS system_notifications;

-- Create system_notifications table
CREATE TABLE system_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'follow', 'like', 'admin', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_system_notifications_to_user_id ON system_notifications(to_user_id);
CREATE INDEX idx_system_notifications_from_user_id ON system_notifications(from_user_id);
CREATE INDEX idx_system_notifications_type ON system_notifications(type);
CREATE INDEX idx_system_notifications_read ON system_notifications(read);
CREATE INDEX idx_system_notifications_created_at ON system_notifications(created_at);

-- Enable Row Level Security
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system_notifications
CREATE POLICY "Users can view their own notifications" ON system_notifications
  FOR SELECT USING (auth.uid() = to_user_id);

CREATE POLICY "Users can update their own notifications" ON system_notifications
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Allow system to insert notifications (for triggers)
CREATE POLICY "System can insert notifications" ON system_notifications
  FOR INSERT WITH CHECK (true);

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(chat_id_param UUID, user_id_param UUID)
RETURNS void AS $$
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  -- Mark all unread messages in this chat as read for the current user
  UPDATE messages 
  SET 
    read_by_receiver = TRUE,
    read_at = NOW()
  WHERE 
    chat_id = chat_id_param 
    AND receiver_id = user_id_param 
    AND read_by_receiver = FALSE
    AND deleted_for_receiver = FALSE
    AND deleted_for_everyone = FALSE;
    
  -- Log how many messages were marked as read
  RAISE NOTICE 'Marked % messages as read for user % in chat %', 
    (SELECT COUNT(*) FROM messages WHERE chat_id = chat_id_param AND receiver_id = user_id_param AND read_by_receiver = TRUE),
    user_id_param, 
    chat_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create follow notification
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
DECLARE
  follower_username TEXT;
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  -- Get the follower's username
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
  
  RAISE NOTICE 'Created follow notification for user % from user %', NEW.following_id, NEW.follower_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create follow notifications
CREATE TRIGGER create_follow_notification_trigger
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();

-- Create function to remove follow notification when unfollowed
CREATE OR REPLACE FUNCTION remove_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  -- Remove the follow notification
  DELETE FROM system_notifications
  WHERE 
    to_user_id = OLD.following_id 
    AND from_user_id = OLD.follower_id 
    AND type = 'follow';
  
  RAISE NOTICE 'Removed follow notification for user % from user %', OLD.following_id, OLD.follower_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to remove follow notifications when unfollowed
CREATE TRIGGER remove_follow_notification_trigger
  AFTER DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION remove_follow_notification();

-- Test the setup by creating a sample notification (replace with actual user IDs)
-- INSERT INTO system_notifications (to_user_id, from_user_id, type, title, message)
-- VALUES ('your-user-id-here', 'another-user-id-here', 'follow', 'Test Notification', 'This is a test notification');

-- Verify the setup
SELECT 'Complete messaging and notifications setup completed successfully!' as status;

-- Show current system notifications count
SELECT 
  'Current system notifications count: ' || COUNT(*)::text as notification_count
FROM system_notifications;