-- Debug why counts aren't showing on frontend after refresh

-- 1. Check what the videos table actually contains for counts
SELECT 
    id,
    title,
    like_count,
    view_count,
    created_at,
    'Direct from videos table' as source
FROM videos 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check what the video_likes table contains
SELECT 
    video_id,
    user_id,
    created_at,
    'From video_likes table' as source
FROM video_likes 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Check what the video_views table contains
SELECT 
    video_id,
    viewer_id,
    creator_id,
    viewed_at,
    'From video_views table' as source
FROM video_views 
ORDER BY viewed_at DESC 
LIMIT 5;

-- 4. Check if the counts in videos table match the actual records
SELECT 
    v.id,
    v.title,
    v.like_count as stored_like_count,
    COUNT(vl.id) as actual_like_count,
    v.view_count as stored_view_count,
    COUNT(vv.id) as actual_view_count,
    CASE 
        WHEN v.like_count = COUNT(vl.id) THEN '✅ Like counts match'
        ELSE '❌ Like counts mismatch'
    END as like_status,
    CASE 
        WHEN v.view_count = COUNT(vv.id) THEN '✅ View counts match'
        ELSE '❌ View counts mismatch'
    END as view_status
FROM videos v
LEFT JOIN video_likes vl ON v.id = vl.video_id
LEFT JOIN video_views vv ON v.id = vv.video_id
GROUP BY v.id, v.title, v.like_count, v.view_count
ORDER BY v.created_at DESC
LIMIT 5;

-- 5. Check for any suspicious like patterns (auto-generated likes)
SELECT 
    vl.video_id,
    v.title,
    v.user_id as video_creator,
    vl.user_id as liker,
    vl.created_at,
    CASE 
        WHEN v.user_id = vl.user_id THEN '⚠️ Creator liked own video'
        ELSE '✅ Normal like'
    END as like_type
FROM video_likes vl
JOIN videos v ON vl.video_id = v.id
ORDER BY vl.created_at DESC
LIMIT 10;