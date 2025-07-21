-- Simple test to find the exact issue

-- 1. Get a video to test with
SELECT 
    id,
    title,
    user_id,
    'Test video' as note
FROM videos 
LIMIT 1;

-- 2. Try the simplest possible insert
DO $$
DECLARE
    test_video_id UUID;
    test_creator_id UUID;
BEGIN
    -- Get video info
    SELECT id, user_id INTO test_video_id, test_creator_id FROM videos LIMIT 1;
    
    RAISE NOTICE 'Attempting to insert view for video: %', test_video_id;
    RAISE NOTICE 'Creator: %', test_creator_id;
    
    -- Try simple insert
    INSERT INTO video_views (video_id, viewer_id, creator_id)
    VALUES (test_video_id, gen_random_uuid(), test_creator_id);
    
    RAISE NOTICE '✅ Insert successful!';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Insert failed with error: %', SQLERRM;
    RAISE NOTICE 'Error code: %', SQLSTATE;
END $$;

-- 3. Check if anything was inserted
SELECT COUNT(*) as views_after_test FROM video_views;

-- 4. If insert worked, test the function
SELECT record_video_view((SELECT id FROM videos LIMIT 1)) as function_result;