-- Check the current REPLICA IDENTITY settings
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('video_likes', 'videos');

-- Check the current state of the video_likes table and videos table
SELECT 
    v.id,
    v.title,
    v.like_count,
    COUNT(vl.id) as actual_like_count
FROM 
    videos v
LEFT JOIN 
    video_likes vl ON v.id = vl.video_id
GROUP BY 
    v.id, v.title, v.like_count
ORDER BY 
    v.created_at DESC
LIMIT 10;