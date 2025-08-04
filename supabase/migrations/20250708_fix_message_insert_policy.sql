-- Fix message insert policy to account for deletion fields
-- Drop and recreate the insert policy to ensure it works with the new schema
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND (
        (chats.sender_id = auth.uid() AND chats.deleted_for_sender = false) OR 
        (chats.receiver_id = auth.uid() AND chats.deleted_for_receiver = false)
      )
    )
  );

-- Also ensure the update policy is correct
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id AND
    deleted_for_everyone = false
  );

-- And the delete policy
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id); 