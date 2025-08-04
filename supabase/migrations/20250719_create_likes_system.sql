-- Create likes system database schema
-- This creates a clean, optimized likes system with proper RLS and performance

-- 1. Create video_likes table
CREATE TABLE IF NOT EXISTS video_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one like per user per video
    UNIQUE(video_id, user_id)
);

-- 2. Add like_count column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL;

-- 3. Enable Row Level Security on video_likes
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for video_likes
-- Users can view all likes (for displaying counts)
CREATE POLICY "video_likes_select" ON video_likes
    FOR SELECT USING (true);

-- Users can only insert their own likes
CREATE POLICY "video_likes_insert" ON video_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own likes
CREATE POLICY "video_likes_delete" ON video_likes
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_likes_video_id ON video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user_id ON video_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user_video ON video_likes(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_created_at ON video_likes(created_at);

-- 6. Create function to update like count
CREATE OR REPLACE FUNCTION update_video_like_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    IF TG_OP = 'INSERT' THEN
        -- Increment like count
        UPDATE videos 
        SET like_count = like_count + 1
        WHERE id = NEW.video_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement like count (ensure it doesn't go below 0)
        UPDATE videos 
        SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = OLD.video_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create triggers to automatically update like counts
CREATE TRIGGER video_likes_insert_trigger
    AFTER INSERT ON video_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_video_like_count();

CREATE TRIGGER video_likes_delete_trigger
    AFTER DELETE ON video_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_video_like_count();

-- 8. Create helper functions for like operations
-- Function to toggle like (like if not liked, unlike if already liked)
CREATE OR REPLACE FUNCTION toggle_video_like(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    like_exists BOOLEAN;
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    -- Get current user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to like videos';
    END IF;
    
    -- Check if like already exists
    SELECT EXISTS(
        SELECT 1 FROM video_likes 
        WHERE video_id = video_uuid AND user_id = current_user_id
    ) INTO like_exists;
    
    IF like_exists THEN
        -- Unlike: remove the like
        DELETE FROM video_likes 
        WHERE video_id = video_uuid AND user_id = current_user_id;
        RETURN FALSE; -- Now unliked
    ELSE
        -- Like: add the like
        INSERT INTO video_likes (video_id, user_id)
        VALUES (video_uuid, current_user_id)
        ON CONFLICT (video_id, user_id) DO NOTHING;
        RETURN TRUE; -- Now liked
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has liked a video
CREATE OR REPLACE FUNCTION user_has_liked_video(video_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    RETURN EXISTS(
        SELECT 1 FROM video_likes 
        WHERE video_id = video_uuid AND user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Initialize like counts for existing videos
UPDATE videos 
SET like_count = (
    SELECT COUNT(*) 
    FROM video_likes 
    WHERE video_likes.video_id = videos.id
)
WHERE like_count IS NULL OR like_count = 0;

-- 10. Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON video_likes TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_video_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_liked_video(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_liked_video(UUID) TO authenticated;

-- Verification: Check that everything was created successfully
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_likes' AND table_schema = 'public') THEN
        RAISE NOTICE 'Success: video_likes table created';
    ELSE
        RAISE NOTICE 'Error: video_likes table not found';
    END IF;
    
    -- Check if like_count column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'like_count' AND table_schema = 'public') THEN
        RAISE NOTICE 'Success: like_count column added to videos table';
    ELSE
        RAISE NOTICE 'Error: like_count column not found in videos table';
    END IF;
    
    -- Check if functions exist
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'toggle_video_like' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: toggle_video_like function created';
    ELSE
        RAISE NOTICE 'Error: toggle_video_like function not found';
    END IF;
END $$;