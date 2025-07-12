-- Fix like count synchronization
-- Run this in your Supabase SQL Editor

-- 1. Recalculate all like counts from the actual video_likes table
UPDATE videos 
SET like_count = (
  SELECT COUNT(*) 
  FROM video_likes 
  WHERE video_likes.video_id = videos.id
);

-- 2. Verify the fix
SELECT 
  v.id,
  v.title,
  v.like_count as current_like_count,
  COUNT(vl.id) as actual_likes_count
FROM videos v
LEFT JOIN video_likes vl ON v.id = vl.video_id
GROUP BY v.id, v.title, v.like_count
ORDER BY v.like_count DESC; 