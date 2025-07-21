-- Verify realtime is properly set up for all social feature tables

-- 1. Check which tables are enabled for realtime
SELECT 
    schemaname,
    tablename,
    '✅ Realtime enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('video_likes', 'video_views', 'videos', 'follows')
ORDER BY tablename;

-- 2. Check if any tables are missing from realtime
SELECT 
    table_name,
    '❌ Missing from realtime' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('video_likes', 'video_views', 'videos', 'follows')
AND table_name NOT IN (
    SELECT tablename 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime'
)
ORDER BY table_name;

-- 3. Test data for realtime - create a test like to see if realtime works
DO $$
DECLARE
    test_video_id UUID;
    test_user_id UUID;
BEGIN
    -- Get test data
    SELECT id INTO test_video_id FROM videos LIMIT 1;
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    -- Insert a test like (this should trigger realtime)
    INSERT INTO video_likes (video_id, user_id)
    VALUES (test_video_id, test_user_id)
    ON CONFLICT (video_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Test like inserted - check if realtime updates work in your app';
    RAISE NOTICE 'Video: %, User: %', test_video_id, test_user_id;
END $$;

-- 4. Show current like counts
SELECT 
    v.id,
    v.title,
    v.like_count,
    COUNT(vl.id) as actual_likes
FROM videos v
LEFT JOIN video_likes vl ON v.id = vl.video_id
GROUP BY v.id, v.title, v.like_count
ORDER BY v.created_at DESC
LIMIT 3;