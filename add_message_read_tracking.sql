-- Add read tracking to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by_receiver BOOLEAN DEFAULT FALSE;

-- Create index for better performance on read status queries
CREATE INDEX IF NOT EXISTS idx_messages_read_by_receiver ON messages(read_by_receiver);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get unread message count for a chat
CREATE OR REPLACE FUNCTION get_unread_count(chat_id_param UUID, user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM messages 
  WHERE 
    chat_id = chat_id_param 
    AND receiver_id = user_id_param 
    AND read_by_receiver = FALSE
    AND deleted_for_receiver = FALSE
    AND deleted_for_everyone = FALSE;
    
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get total unread message count for a user
CREATE OR REPLACE FUNCTION get_total_unread_count(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  total_unread INTEGER;
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  SELECT COUNT(*)::INTEGER INTO total_unread
  FROM messages m
  JOIN chats c ON m.chat_id = c.id
  WHERE 
    m.receiver_id = user_id_param 
    AND m.read_by_receiver = FALSE
    AND m.deleted_for_receiver = FALSE
    AND m.deleted_for_everyone = FALSE
    AND (
      (c.sender_id = user_id_param AND c.deleted_for_sender = FALSE) OR
      (c.receiver_id = user_id_param AND c.deleted_for_receiver = FALSE)
    );
    
  RETURN COALESCE(total_unread, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;