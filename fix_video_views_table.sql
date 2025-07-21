a-- Fix the video_views table structure

-- 1. Check current structure of video_views table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'video_views' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Add the missing creator_id column
ALTER TABLE video_views ADD COLUMN IF NOT EXISTS creator_id UUID;

-- 3. Update existing records to have creator_id (get it from videos table)
UPDATE video_views 
SET creator_id = v.user_id
FROM videos v 
WHERE video_views.video_id = v.id 
AND video_views.creator_id IS NULL;

-- 4. Make creator_id NOT NULL after updating existing records
ALTER TABLE video_views ALTER COLUMN creator_id SET NOT NULL;

-- 5. Verify the table structure is correct now
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'video_views' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Now test the function again
SELECT 
    record_video_view((SELECT id FROM videos LIMIT 1)) as test_result,
    'Should work now with creator_id column' as note;

-- 7. Check if views are being recorded
SELECT COUNT(*) as total_views_after_column_fix FROM video_views;