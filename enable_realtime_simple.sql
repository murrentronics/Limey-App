-- Enable real-time for messages and chats tables
-- Run this in your Supabase SQL Editor

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable real-time for chats table  
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- Verify the tables are now in the real-time publication
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'; 