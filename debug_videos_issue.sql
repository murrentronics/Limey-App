-- Debug why videos are not showing in the feed

-- 1. Check if videos table exists and has data
SELECT 
    COUNT(*) as total_videos,
    COUNT(CASE WHEN video_url IS NOT NULL THEN 1 END) as videos_with_url,
    COUNT(CASE WHEN title IS NOT NULL THEN 1 END) as videos_with_title
FROM videos;

-- 2. Show sample videos if they exist
SELECT 
    id,
    title,
    video_url,
    user_id,
    created_at,
    view_count,
    like_count
FROM videos 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Check videos table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'videos' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check if there are any RLS policies blocking video access
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'videos';

-- 5. Test a simple select as if the app would do it
SELECT 
    v.*,
    p.username,
    p.avatar_url
FROM videos v
LEFT JOIN profiles p ON v.user_id = p.user_id
ORDER BY v.created_at DESC
LIMIT 3;