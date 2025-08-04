-- Enable full data in DELETE events for video_likes table
ALTER TABLE video_likes REPLICA IDENTITY FULL;

-- Enable full data in UPDATE events for videos table
ALTER TABLE videos REPLICA IDENTITY FULL;

-- Check the current REPLICA IDENTITY settings
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('video_likes', 'videos');

-- Fix any mismatches between the like_count in videos table and the actual count in video_likes
UPDATE videos v
SET like_count = (
    SELECT COUNT(*)
    FROM video_likes vl
    WHERE vl.video_id = v.id
);

-- Verify the like counts are correct
SELECT 
    v.id,
    v.title,
    v.like_count as stored_count,
    COUNT(vl.id) as actual_count,
    CASE 
        WHEN v.like_count <> COUNT(vl.id) THEN 'MISMATCH'
        ELSE 'OK'
    END as status
FROM 
    videos v
LEFT JOIN 
    video_likes vl ON v.id = vl.video_id
GROUP BY 
    v.id, v.title, v.like_count
ORDER BY 
    v.created_at DESC
LIMIT 10;