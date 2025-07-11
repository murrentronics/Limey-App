-- Fix the RLS policy for messages to allow viewing deleted messages
-- This allows the frontend to show "Message deleted" indicators

-- Drop the existing policy that filters out deleted messages
DROP POLICY IF EXISTS "Users can view messages in their chats that aren't deleted for everyone" ON messages;

-- Create a new policy that allows viewing all messages in chats the user is part of
-- The frontend will handle showing "Message deleted" indicators
CREATE POLICY "Users can view messages in their chats" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND (
        (chats.sender_id = auth.uid() AND chats.deleted_for_sender = false) OR 
        (chats.receiver_id = auth.uid() AND chats.deleted_for_receiver = false)
      )
    )
  );

-- Also ensure the update policy allows updating deleted messages for the sender
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id
  ); 