-- Check current database status for views system

-- Check if video_views table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_views' AND table_schema = 'public') 
        THEN '✅ video_views table EXISTS' 
        ELSE '❌ video_views table MISSING' 
    END as video_views_table_status;

-- Check if record_video_view function exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'record_video_view' AND routine_schema = 'public') 
        THEN '✅ record_video_view function EXISTS' 
        ELSE '❌ record_video_view function MISSING' 
    END as record_video_view_function_status;

-- Check if toggle_video_like function exists (for likes)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'toggle_video_like' AND routine_schema = 'public') 
        THEN '✅ toggle_video_like function EXISTS' 
        ELSE '❌ toggle_video_like function MISSING' 
    END as toggle_video_like_function_status;

-- List all existing functions that contain 'video' in the name
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%video%'
ORDER BY routine_name;