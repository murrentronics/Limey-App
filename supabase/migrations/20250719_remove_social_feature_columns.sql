-- Migration to remove social feature columns from main tables
-- This removes like_count, view_count, comment_count from videos table
-- and follower_count from profiles table

-- 1. First, drop any functions that reference these columns
DROP FUNCTION IF EXISTS increment_like_count(UUID);
DROP FUNCTION IF EXISTS decrement_like_count(UUID);
DROP FUNCTION IF EXISTS decrement_like_count_secure(UUID);
DROP FUNCTION IF EXISTS get_genuine_view_count(UUID);
DROP FUNCTION IF EXISTS update_video_view_count();

-- 2. Drop any remaining triggers that might reference these columns
DROP TRIGGER IF EXISTS update_video_view_count_trigger ON videos;
DROP TRIGGER IF EXISTS update_video_view_count_delete_trigger ON videos;

-- 3. Remove social feature columns from videos table
ALTER TABLE videos DROP COLUMN IF EXISTS like_count;
ALTER TABLE videos DROP COLUMN IF EXISTS view_count;
ALTER TABLE videos DROP COLUMN IF EXISTS comment_count;

-- 4. Remove social feature columns from profiles table
ALTER TABLE profiles DROP COLUMN IF EXISTS follower_count;
ALTER TABLE profiles DROP COLUMN IF EXISTS following_count;

-- 5. Drop any indexes that were specifically for these columns
DROP INDEX IF EXISTS idx_videos_like_count;
DROP INDEX IF EXISTS idx_videos_view_count;
DROP INDEX IF EXISTS idx_videos_comment_count;
DROP INDEX IF EXISTS idx_profiles_follower_count;

-- 6. Clean up any views that might reference these columns
-- (Note: We'll drop and recreate any views if they exist and reference these columns)
DROP VIEW IF EXISTS video_stats;
DROP VIEW IF EXISTS user_stats;

-- Verification: Check that columns are removed
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    -- Check if social feature columns still exist in videos table
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'videos' 
    AND table_schema = 'public'
    AND column_name IN ('like_count', 'view_count', 'comment_count');
    
    IF col_count > 0 THEN
        RAISE NOTICE 'Warning: % social feature columns still exist in videos table', col_count;
    ELSE
        RAISE NOTICE 'Success: All social feature columns removed from videos table';
    END IF;
    
    -- Check if social feature columns still exist in profiles table
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND table_schema = 'public'
    AND column_name IN ('follower_count', 'following_count');
    
    IF col_count > 0 THEN
        RAISE NOTICE 'Warning: % social feature columns still exist in profiles table', col_count;
    ELSE
        RAISE NOTICE 'Success: All social feature columns removed from profiles table';
    END IF;
END $$;