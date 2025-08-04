-- Debug the like duplication issue on page refresh

-- 1. Clear all likes to start fresh
DELETE FROM video_likes;

-- 2. Reset all like counts to 0
UPDATE videos SET like_count = 0;

-- 3. Create a test scenario - manually add ONE like
DO $$
DECLARE
    test_video_id UUID;
    test_user_id UUID;
BEGIN
    -- Get a test video and user
    SELECT id INTO test_video_id FROM videos LIMIT 1;
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    -- Add exactly ONE like
    INSERT INTO video_likes (video_id, user_id)
    VALUES (test_video_id, test_user_id);
    
    -- Update the count
    UPDATE videos 
    SET like_count = 1
    WHERE id = test_video_id;
    
    RAISE NOTICE 'Added 1 test like for video: % by user: %', test_video_id, test_user_id;
END $$;

-- 4. Verify we have exactly 1 like
SELECT 
    COUNT(*) as total_likes,
    'Should be exactly 1' as note
FROM video_likes;

-- 5. Show the test data
SELECT 
    vl.video_id,
    v.title,
    v.like_count as stored_count,
    COUNT(vl.id) as actual_count,
    vl.user_id,
    vl.created_at
FROM video_likes vl
JOIN videos v ON vl.video_id = v.id
GROUP BY vl.video_id, v.title, v.like_count, vl.user_id, vl.created_at;

-- 6. Now test the toggle function to see if it duplicates
SELECT 
    'Now test in your app - like a video, then refresh the page' as instruction,
    'Check if the like count increases from 1 to 2 on refresh' as what_to_watch;