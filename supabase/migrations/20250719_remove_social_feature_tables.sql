-- Migration to remove all social feature tables and related objects
-- This migration removes likes, views, follows, and comments functionality

-- 1. Drop triggers first (to avoid dependency issues)
DROP TRIGGER IF EXISTS video_like_insert_trigger ON video_likes;
DROP TRIGGER IF EXISTS video_like_delete_trigger ON video_likes;
DROP TRIGGER IF EXISTS update_video_view_count_trigger ON video_views;
DROP TRIGGER IF EXISTS update_video_view_count_delete_trigger ON video_views;

-- 2. Drop functions related to social features
DROP FUNCTION IF EXISTS handle_video_like_insert();
DROP FUNCTION IF EXISTS handle_video_like_delete();
DROP FUNCTION IF EXISTS record_video_view(UUID);
DROP FUNCTION IF EXISTS get_genuine_view_count(UUID);
DROP FUNCTION IF EXISTS update_video_view_count();

-- 3. Remove tables from real-time publication (if they exist)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS video_likes;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS video_views;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS follows;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS comments;

-- 4. Drop social feature tables
-- Drop video_likes table and all its dependencies
DROP TABLE IF EXISTS video_likes CASCADE;

-- Drop video_views table and all its dependencies  
DROP TABLE IF EXISTS video_views CASCADE;

-- Drop follows table and all its dependencies
DROP TABLE IF EXISTS follows CASCADE;

-- Drop comments table and all its dependencies (if it exists)
DROP TABLE IF EXISTS comments CASCADE;

-- 5. Drop any remaining indexes related to social features
DROP INDEX IF EXISTS idx_video_likes_user_video;
DROP INDEX IF EXISTS idx_video_likes_video_id;
DROP INDEX IF EXISTS idx_video_likes_user_id;
DROP INDEX IF EXISTS idx_video_views_video_id;
DROP INDEX IF EXISTS idx_video_views_viewer_id;
DROP INDEX IF EXISTS idx_follows_follower_id;
DROP INDEX IF EXISTS idx_follows_following_id;
DROP INDEX IF EXISTS idx_comments_video_id;
DROP INDEX IF EXISTS idx_comments_user_id;

-- 6. Clean up any remaining policies (CASCADE should handle this, but being explicit)
-- Note: Policies are automatically dropped when tables are dropped with CASCADE

-- Verification: Check that tables are removed
DO $$
BEGIN
    -- Check if any social feature tables still exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('video_likes', 'video_views', 'follows', 'comments') AND table_schema = 'public') THEN
        RAISE NOTICE 'Warning: Some social feature tables may still exist';
    ELSE
        RAISE NOTICE 'Success: All social feature tables have been removed';
    END IF;
END $$;