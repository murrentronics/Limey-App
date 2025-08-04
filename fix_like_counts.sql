-- Fix like counts to match actual likes in video_likes table
-- Run this in your Supabase SQL Editor

-- First, let's see what we have
SELECT 'Current state:' as info;
SELECT 
  'video_likes table' as table_name,
  COUNT(*) as total_likes,
  COUNT(DISTINCT video_id) as unique_videos_liked
FROM video_likes;

SELECT 
  'videos table' as table_name,
  SUM(like_count) as total_like_count,
  COUNT(*) as total_videos
FROM videos;

-- Now let's see the breakdown by video
SELECT 
  'video_likes breakdown:' as info;
SELECT 
  video_id,
  COUNT(*) as actual_likes
FROM video_likes 
GROUP BY video_id 
ORDER BY video_id;

SELECT 
  'videos table like counts:' as info;
SELECT 
  id as video_id,
  like_count as current_like_count
FROM videos 
WHERE like_count > 0
ORDER BY id;

-- Fix the like counts to match actual likes
UPDATE videos 
SET like_count = (
  SELECT COUNT(*) 
  FROM video_likes 
  WHERE video_likes.video_id = videos.id
);

-- Verify the fix
SELECT 'After fix:' as info;
SELECT 
  'video_likes table' as table_name,
  COUNT(*) as total_likes,
  COUNT(DISTINCT video_id) as unique_videos_liked
FROM video_likes;

SELECT 
  'videos table' as table_name,
  SUM(like_count) as total_like_count,
  COUNT(*) as total_videos
FROM videos;

-- Show the corrected breakdown
SELECT 
  'Corrected like counts:' as info;
SELECT 
  v.id as video_id,
  v.like_count as corrected_like_count,
  COUNT(vl.id) as actual_likes_in_table
FROM videos v
LEFT JOIN video_likes vl ON v.id = vl.video_id
GROUP BY v.id, v.like_count
HAVING v.like_count > 0 OR COUNT(vl.id) > 0
ORDER BY v.id; 