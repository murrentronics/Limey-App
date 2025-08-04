-- Comprehensive diagnosis of the views system

-- 1. Check if video_views table exists and its structure
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_views' AND table_schema = 'public') 
        THEN '✅ video_views table EXISTS' 
        ELSE '❌ video_views table MISSING' 
    END as table_status;

-- 2. If table exists, show its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'video_views' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check RLS policies on video_views table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'video_views';

-- 4. Check function permissions for record_video_view
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    array_to_string(p.proacl, ', ') as permissions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'record_video_view';

-- 5. Test the function with a sample call (this will show if there are permission issues)
-- Note: This is just to test if the function can be called, it won't actually record a view
SELECT 'Testing function call...' as test_status;

-- 6. Check if there are any triggers on video_views
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'video_views';

-- 7. Count existing records in video_views (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_views' AND table_schema = 'public') THEN
        EXECUTE 'SELECT COUNT(*) as total_views FROM video_views';
    ELSE
        RAISE NOTICE 'video_views table does not exist';
    END IF;
END $$;