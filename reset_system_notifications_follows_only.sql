-- Drop everything related to system_notifications and recreate cleanly (follows only)

-- Drop triggers first
DROP TRIGGER IF EXISTS create_follow_notification_trigger ON follows;
DROP TRIGGER IF EXISTS remove_follow_notification_trigger ON follows;

-- Drop functions
DROP FUNCTION IF EXISTS create_follow_notification();
DROP FUNCTION IF EXISTS remove_follow_notification();

-- Drop table (this will also drop all policies and indexes)
DROP TABLE IF EXISTS system_notifications;

-- Now recreate everything cleanly

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
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to remove follow notifications when unfollowed
CREATE TRIGGER remove_follow_notification_trigger
  AFTER DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION remove_follow_notification();

-- Verify the setup
SELECT 'System notifications setup completed successfully (follows only)!' as status;
-- 
Create function to mark messages as read (if it doesn't exist)
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;