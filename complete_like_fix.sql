-- Complete like system fix
-- Run this in your Supabase SQL Editor

-- Step 1: Clear everything
DELETE FROM video_likes;
UPDATE videos SET like_count = 0;

-- Step 2: Drop all triggers and functions
DROP TRIGGER IF EXISTS video_like_insert_trigger ON video_likes;
DROP TRIGGER IF EXISTS video_like_delete_trigger ON video_likes;
DROP FUNCTION IF EXISTS handle_video_like_insert();
DROP FUNCTION IF EXISTS handle_video_like_delete();
DROP FUNCTION IF EXISTS increment_like_count(UUID);
DROP FUNCTION IF EXISTS decrement_like_count(UUID);

-- Step 3: Enable real-time for video_likes table
ALTER PUBLICATION supabase_realtime ADD TABLE video_likes;

-- Step 4: Verify the setup
SELECT 
  'Real-time tables:' as info;
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('videos', 'video_likes', 'video_views')
ORDER BY tablename;

-- Step 5: Verify everything is clean
SELECT 
  'Clean state verification:' as info;
SELECT 
  'video_likes' as table_name,
  COUNT(*) as total_likes
FROM video_likes
UNION ALL
SELECT 
  'videos' as table_name,
  SUM(like_count) as total_like_count
FROM videos;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Like system has been completely reset!';
  RAISE NOTICE 'All likes cleared, triggers removed, real-time enabled.';
  RAISE NOTICE 'Frontend will now handle all like counting.';
END $$; 