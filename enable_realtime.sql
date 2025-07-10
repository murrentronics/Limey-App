-- Enable real-time for messages table
-- Run this in your Supabase SQL Editor

-- Check if real-time is enabled for messages table
SELECT 
  schemaname,
  tablename
FROM pg_tables 
WHERE tablename = 'messages';

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Also enable real-time for chats table
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- Check what tables are in the real-time publication
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Alternative way to check if real-time is working
-- This will show all tables that are part of the real-time publication
SELECT 
  n.nspname as schema_name,
  c.relname as table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_publication_rel pr ON pr.prrelid = c.oid
JOIN pg_publication p ON p.oid = pr.prpubid
WHERE p.pubname = 'supabase_realtime'
ORDER BY schema_name, table_name; 