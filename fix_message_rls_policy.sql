-- Debug and fix the record_video_view function

-- 1. Check if the function exists and its exact signature
SELECT 
    routine_name,
    routine_type,
    pg_get_function_identity_arguments(p.oid) as function_signature,
    pg_get_function_result(p.oid) as return_type
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE r.routine_schema = 'public' 
AND r.routine_name = 'record_video_view'
AND n.nspname = 'public';

-- 2. Check if video_views table exists and has proper structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'video_views' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Test the function with a real video ID
-- First, get a real video ID
SELECT id, title FROM videos LIMIT 1;

-- 4. Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS record_video_view(uuid);

CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    video_creator_id UUID;
    view_recorded BOOLEAN := FALSE;
BEGIN
    -- Get current user (can be null for anonymous users)
    current_user_id := auth.uid();
    
    -- Check if video exists and get creator ID
    SELECT user_id INTO video_creator_id 
    FROM videos 
    WHERE id = video_uuid;
    
    -- If video doesn't exist, return false
    IF video_creator_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Handle anonymous users
    IF current_user_id IS NULL THEN
        -- For anonymous users, always record a view with random UUID
        BEGIN
            INSERT INTO video_views (video_id, viewer_id, creator_id)
            VALUES (video_uuid, gen_random_uuid(), video_creator_id);
            view_recorded := TRUE;
        EXCEPTION WHEN OTHERS THEN
            -- If insert fails, return false but don't error
            view_recorded := FALSE;
        END;
    ELSE
        -- For authenticated users, only record if not the creator
        IF current_user_id != video_creator_id THEN
            BEGIN
                INSERT INTO video_views (video_id, viewer_id, creator_id)
                VALUES (video_uuid, current_user_id, video_creator_id)
                ON CONFLICT (video_id, viewer_id) DO NOTHING;
                
                -- Check if insert happened
                GET DIAGNOSTICS view_recorded = ROW_COUNT;
                view_recorded := view_recorded > 0;
            EXCEPTION WHEN OTHERS THEN
                -- If insert fails, return false but don't error
                view_recorded := FALSE;
            END;
        END IF;
    END IF;
    
    RETURN view_recorded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO anon;

-- 6. Test the function
SELECT record_video_view((SELECT id FROM videos LIMIT 1)) as test_result;