-- Add fields to track chat deletion per user
ALTER TABLE chats ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN DEFAULT FALSE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN DEFAULT FALSE;

-- Add field to track message deletion for everyone
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance on deletion fields
CREATE INDEX IF NOT EXISTS idx_chats_deleted_for_sender ON chats(deleted_for_sender) WHERE deleted_for_sender = true;
CREATE INDEX IF NOT EXISTS idx_chats_deleted_for_receiver ON chats(deleted_for_receiver) WHERE deleted_for_receiver = true;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for_everyone ON messages(deleted_for_everyone) WHERE deleted_for_everyone = true;

-- Update RLS policies to filter out deleted chats for users
DROP POLICY IF EXISTS "Users can view chats they are part of" ON chats;
CREATE POLICY "Users can view chats they are part of and haven't deleted" ON chats
  FOR SELECT USING (
    (auth.uid() = sender_id AND deleted_for_sender = false) OR 
    (auth.uid() = receiver_id AND deleted_for_receiver = false)
  );

-- Update RLS policies to filter out deleted messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
CREATE POLICY "Users can view messages in their chats that aren't deleted for everyone" ON messages
  FOR SELECT USING (
    deleted_for_everyone = false AND
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND (
        (chats.sender_id = auth.uid() AND chats.deleted_for_sender = false) OR 
        (chats.receiver_id = auth.uid() AND chats.deleted_for_receiver = false)
      )
    )
  ); 