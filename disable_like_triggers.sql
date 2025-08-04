-- Keep the update_video_like_count trigger disabled
-- This is to prevent double-counting of likes

-- Verify that the trigger is disabled
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled
FROM 
    pg_trigger
WHERE 
    tgname = 'update_video_like_count';

-- Check the definition of the toggle_video_like function to ensure it's updating like counts
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM 
    pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE 
    p.proname = 'toggle_video_like';