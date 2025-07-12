-- Disable problematic like triggers and handle counting in frontend
-- Run this in your Supabase SQL Editor

-- Drop the problematic triggers
DROP TRIGGER IF EXISTS video_like_insert_trigger ON video_likes;
DROP TRIGGER IF EXISTS video_like_delete_trigger ON video_likes;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS handle_video_like_insert();
DROP FUNCTION IF EXISTS handle_video_like_delete();
DROP FUNCTION IF EXISTS increment_like_count(UUID);
DROP FUNCTION IF EXISTS decrement_like_count(UUID);

-- Clear all likes to start fresh
DELETE FROM video_likes;

-- Reset all like counts to 0
UPDATE videos SET like_count = 0;

-- Verify triggers are removed
SELECT 
  trigger_name,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_name IN ('video_like_insert_trigger', 'video_like_delete_trigger');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Like triggers have been disabled successfully!';
  RAISE NOTICE 'Like counting will now be handled in the frontend.';
  RAISE NOTICE 'All likes have been cleared for a fresh start.';
END $$; 