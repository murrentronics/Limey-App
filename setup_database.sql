-- Complete database setup for Limey App
-- Run this in your Supabase SQL Editor

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message TEXT,
  deleted_for_sender BOOLEAN DEFAULT FALSE,
  deleted_for_receiver BOOLEAN DEFAULT FALSE,
  typing_sender BOOLEAN DEFAULT FALSE,
  typing_receiver BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  deleted_for_sender BOOLEAN DEFAULT FALSE,
  deleted_for_receiver BOOLEAN DEFAULT FALSE,
  deleted_for_everyone BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_sender_id ON chats(sender_id);
CREATE INDEX IF NOT EXISTS idx_chats_receiver_id ON chats(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chats_deleted_for_sender ON chats(deleted_for_sender) WHERE deleted_for_sender = true;
CREATE INDEX IF NOT EXISTS idx_chats_deleted_for_receiver ON chats(deleted_for_receiver) WHERE deleted_for_receiver = true;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for_everyone ON messages(deleted_for_everyone) WHERE deleted_for_everyone = true;
CREATE INDEX IF NOT EXISTS idx_chats_typing_sender ON chats(typing_sender) WHERE typing_sender = true;
CREATE INDEX IF NOT EXISTS idx_chats_typing_receiver ON chats(typing_receiver) WHERE typing_receiver = true;

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view chats they are part of" ON chats;
DROP POLICY IF EXISTS "Users can view chats they are part of and haven't deleted" ON chats;
DROP POLICY IF EXISTS "Users can insert chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;

DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats that aren't deleted for everyone" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Create RLS policies for chats
CREATE POLICY "Users can view chats they are part of and haven't deleted" ON chats
  FOR SELECT USING (
    (auth.uid() = sender_id AND deleted_for_sender = false) OR 
    (auth.uid() = receiver_id AND deleted_for_receiver = false)
  );

CREATE POLICY "Users can insert chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Create RLS policies for messages
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

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id AND
    deleted_for_everyone = false
  );

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Create function to update chat's last_message and updated_at
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats 
  SET last_message = NEW.content, updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update chat timestamp
DROP TRIGGER IF EXISTS update_chat_timestamp_trigger ON messages;
CREATE TRIGGER update_chat_timestamp_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_timestamp();

-- Create function to record video views
CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE videos 
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = video_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated; 