-- Disable real-time and fix like counts
-- Run this in your Supabase SQL Editor

-- 1. Remove tables from real-time publication to prevent conflicts
ALTER PUBLICATION supabase_realtime DROP TABLE videos;
ALTER PUBLICATION supabase_realtime DROP TABLE video_likes;

-- 2. Fix all like counts by recalculating from video_likes table
UPDATE videos 
SET like_count = (
  SELECT COUNT(*) 
  FROM video_likes 
  WHERE video_likes.video_id = videos.id
);

-- 3. Verify the fix
SELECT 
  v.id,
  v.title,
  v.like_count as current_like_count,
  COUNT(vl.id) as actual_likes_count
FROM videos v
LEFT JOIN video_likes vl ON v.id = vl.video_id
GROUP BY v.id, v.title, v.like_count
ORDER BY v.like_count DESC; 