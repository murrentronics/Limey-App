-- Detailed debug of the record_video_view function

-- 1. First, let's see what videos exist and their creators
SELECT 
    id as video_id,
    title,
    user_id as creator_id,
    'Available for testing' as status
FROM videos 
LIMIT 3;

-- 2. Check current authentication status
SELECT 
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN 'Anonymous - will use random UUID'
        ELSE 'Authenticated - will use real user ID'
    END as user_status;

-- 3. Manual step-by-step test of what the function should do
DO $$
DECLARE
    test_video_id UUID;
    test_creator_id UUID;
    current_user_id UUID;
    random_viewer_id UUID;
    insert_result INTEGER;
BEGIN
    -- Get a test video
    SELECT id, user_id INTO test_video_id, test_creator_id
    FROM videos 
    LIMIT 1;
    
    current_user_id := auth.uid();
    
    RAISE NOTICE '=== TESTING RECORD_VIDEO_VIEW LOGIC ===';
    RAISE NOTICE 'Video ID: %', test_video_id;
    RAISE NOTICE 'Creator ID: %', test_creator_id;
    RAISE NOTICE 'Current User ID: %', current_user_id;
    
    -- Test the video exists check
    IF test_creator_id IS NULL THEN
        RAISE NOTICE '❌ Video not found or no creator';
        RETURN;
    ELSE
        RAISE NOTICE '✅ Video exists with creator';
    END IF;
    
    -- Test the anonymous user path
    IF current_user_id IS NULL THEN
        RAISE NOTICE '📝 Testing anonymous user path...';
        random_viewer_id := gen_random_uuid();
        
        BEGIN
            INSERT INTO video_views (video_id, viewer_id, creator_id)
            VALUES (test_video_id, random_viewer_id, test_creator_id);
            
            GET DIAGNOSTICS insert_result = ROW_COUNT;
            RAISE NOTICE '✅ Anonymous insert successful, rows affected: %', insert_result;
            
            -- Clean up
            DELETE FROM video_views WHERE viewer_id = random_viewer_id;
            RAISE NOTICE '🧹 Cleaned up test record';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Anonymous insert failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '📝 Testing authenticated user path...';
        
        -- Check if user is the creator
        IF current_user_id = test_creator_id THEN
            RAISE NOTICE '⚠️ User is the creator - view should be blocked';
        ELSE
            RAISE NOTICE '✅ User is not the creator - view should be allowed';
            
            BEGIN
                INSERT INTO video_views (video_id, viewer_id, creator_id)
                VALUES (test_video_id, current_user_id, test_creator_id)
                ON CONFLICT (video_id, viewer_id) DO NOTHING;
                
                GET DIAGNOSTICS insert_result = ROW_COUNT;
                RAISE NOTICE '✅ Authenticated insert result, rows affected: %', insert_result;
                
                IF insert_result > 0 THEN
                    RAISE NOTICE '✅ New view recorded';
                ELSE
                    RAISE NOTICE '⚠️ View already exists (conflict)';
                END IF;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ Authenticated insert failed: %', SQLERRM;
            END;
        END IF;
    END IF;
END $$;

-- 4. Now test the actual function
SELECT record_video_view((SELECT id FROM videos LIMIT 1)) as actual_function_result;

-- 5. Check current state of video_views table
SELECT 
    COUNT(*) as total_views,
    COUNT(DISTINCT video_id) as videos_with_views,
    COUNT(DISTINCT viewer_id) as unique_viewers
FROM video_views;