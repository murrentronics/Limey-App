-- Clear all video likes and reset like counts
-- Run this in your Supabase SQL Editor to start fresh

-- Clear all likes from video_likes table
DELETE FROM video_likes;

-- Reset all like counts to 0 in videos table
UPDATE videos SET like_count = 0;

-- Verify the cleanup
SELECT 
  'video_likes' as table_name,
  COUNT(*) as remaining_likes
FROM video_likes
UNION ALL
SELECT 
  'videos' as table_name,
  SUM(like_count) as total_likes
FROM videos;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All video likes have been cleared successfully!';
  RAISE NOTICE 'Like counts have been reset to 0.';
  RAISE NOTICE 'You can now test the like functionality fresh.';
END $$; 