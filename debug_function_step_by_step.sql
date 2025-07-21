-- Debug the function by recreating it with detailed logging

-- 1. Drop and recreate the function with debug output
DROP FUNCTION IF EXISTS record_video_view(uuid);

CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    video_creator_id UUID;
    view_recorded BOOLEAN := FALSE;
    insert_count INTEGER;
BEGIN
    RAISE NOTICE '=== RECORD_VIDEO_VIEW DEBUG START ===';
    RAISE NOTICE 'Input video_uuid: %', video_uuid;
    
    -- Get current user
    current_user_id := auth.uid();
    RAISE NOTICE 'Current user ID: %', current_user_id;
    
    -- Check if video exists and get creator ID
    SELECT user_id INTO video_creator_id 
    FROM videos 
    WHERE id = video_uuid;
    
    RAISE NOTICE 'Video creator ID: %', video_creator_id;
    
    -- If video doesn't exist, return false
    IF video_creator_id IS NULL THEN
        RAISE NOTICE '❌ Video not found, returning false';
        RETURN FALSE;
    END IF;
    
    -- Handle anonymous users
    IF current_user_id IS NULL THEN
        RAISE NOTICE '📝 Processing anonymous user...';
        BEGIN
            INSERT INTO video_views (video_id, viewer_id, creator_id)
            VALUES (video_uuid, gen_random_uuid(), video_creator_id);
            
            GET DIAGNOSTICS insert_count = ROW_COUNT;
            RAISE NOTICE '✅ Anonymous insert completed, rows: %', insert_count;
            view_recorded := TRUE;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Anonymous insert failed: %', SQLERRM;
            view_recorded := FALSE;
        END;
    ELSE
        RAISE NOTICE '📝 Processing authenticated user...';
        -- For authenticated users, only record if not the creator
        IF current_user_id = video_creator_id THEN
            RAISE NOTICE '⚠️ User is creator, blocking self-view';
            view_recorded := FALSE;
        ELSE
            RAISE NOTICE '✅ User is not creator, allowing view';
            BEGIN
                INSERT INTO video_views (video_id, viewer_id, creator_id)
                VALUES (video_uuid, current_user_id, video_creator_id)
                ON CONFLICT (video_id, viewer_id) DO NOTHING;
                
                GET DIAGNOSTICS insert_count = ROW_COUNT;
                RAISE NOTICE '✅ Authenticated insert completed, rows: %', insert_count;
                
                IF insert_count > 0 THEN
                    view_recorded := TRUE;
                    RAISE NOTICE '✅ New view recorded';
                ELSE
                    view_recorded := FALSE;
                    RAISE NOTICE '⚠️ View already exists (duplicate)';
                END IF;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ Authenticated insert failed: %', SQLERRM;
                view_recorded := FALSE;
            END;
        END IF;
    END IF;
    
    RAISE NOTICE '=== FINAL RESULT: % ===', view_recorded;
    RETURN view_recorded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant permissions
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO anon;

-- 3. Test the function with debug output
SELECT record_video_view((SELECT id FROM videos LIMIT 1)) as test_result;

-- 4. Check final state
SELECT COUNT(*) as total_views_after_test FROM video_views;