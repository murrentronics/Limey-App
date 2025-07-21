-- Check the current state of video_likes table
SELECT 
    vl.id,
    vl.video_id,
    vl.user_id,
    vl.created_at,
    v.title as video_title,
    v.like_count
FROM video_likes vl
JOIN videos v ON vl.video_id = v.id
ORDER BY vl.created_at DESC
LIMIT 10;

-- Check if there are any RLS policies that might be affecting the DELETE payload
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'video_likes';

-- Check the structure of the video_likes table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'video_likes' 
AND table_schema = 'public'
ORDER BY ordinal_position;