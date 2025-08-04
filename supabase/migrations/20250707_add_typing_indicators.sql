-- Add typing indicator columns to chats table
ALTER TABLE chats ADD COLUMN IF NOT EXISTS typing_sender BOOLEAN DEFAULT FALSE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS typing_receiver BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance on typing fields
CREATE INDEX IF NOT EXISTS idx_chats_typing_sender ON chats(typing_sender) WHERE typing_sender = true;
CREATE INDEX IF NOT EXISTS idx_chats_typing_receiver ON chats(typing_receiver) WHERE typing_receiver = true;

-- Drop existing policy and recreate it to allow typing status updates
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id); 