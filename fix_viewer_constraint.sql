-- Fix the video_views table by removing problematic foreign key constraints

-- 1. Check what the foreign key constraints reference
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'video_views';

-- 2. Drop the problematic foreign key constraint on viewer_id
ALTER TABLE video_views DROP CONSTRAINT IF EXISTS video_views_viewer_id_fkey;

-- 3. Test inserting a view with random UUID (should work now)
DO $$
DECLARE
    test_video_id UUID;
    random_viewer_id UUID;
    test_creator_id UUID;
BEGIN
    -- Get a test video
    SELECT id, user_id INTO test_video_id, test_creator_id
    FROM videos 
    LIMIT 1;
    
    -- Generate random viewer ID
    random_viewer_id := gen_random_uuid();
    
    -- Try to insert a test view
    INSERT INTO video_views (video_id, viewer_id, creator_id)
    VALUES (test_video_id, random_viewer_id, test_creator_id);
    
    RAISE NOTICE '✅ Successfully inserted test view with random UUID';
    RAISE NOTICE 'Video: %, Viewer: %, Creator: %', test_video_id, random_viewer_id, test_creator_id;
    
    -- Clean up the test record
    DELETE FROM video_views WHERE viewer_id = random_viewer_id;
    RAISE NOTICE '✅ Test record cleaned up';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Insert failed: %', SQLERRM;
END $$;

-- 4. Now test the record_video_view function
SELECT 
    record_video_view((SELECT id FROM videos LIMIT 1)) as function_test_result,
    'Should return true now' as note;