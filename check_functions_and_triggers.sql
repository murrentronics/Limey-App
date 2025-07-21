-- Check the definition of the update_video_like_count trigger
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled,
    tgfoid::regproc as function_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM 
    pg_trigger
WHERE 
    tgname = 'update_video_like_count';

-- Check the definition of the toggle_video_like function
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM 
    pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE 
    p.proname = 'toggle_video_like';

-- Check if there are any other functions that might be updating like counts
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM 
    pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE 
    p.proname LIKE '%like%count%' OR
    p.proname LIKE '%update%like%' OR
    p.proname LIKE '%increment%like%' OR
    p.proname LIKE '%decrement%like%';