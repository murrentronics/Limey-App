-- Fix missing likes system functions
-- This ensures all functions for the likes system are properly created

-- 1. Create the missing user_has_liked_video function
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

-- 2. Ensure toggle_video_like function exists and works properly
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

-- 3. Ensure update_video_like_count trigger function exists
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

-- 4. Ensure triggers exist
DROP TRIGGER IF EXISTS video_likes_insert_trigger ON video_likes;
DROP TRIGGER IF EXISTS video_likes_delete_trigger ON video_likes;

CREATE TRIGGER video_likes_insert_trigger
    AFTER INSERT ON video_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_video_like_count();

CREATE TRIGGER video_likes_delete_trigger
    AFTER DELETE ON video_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_video_like_count();

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON video_likes TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_video_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_liked_video(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_liked_video(UUID) TO authenticated;

-- 6. Verification
DO $$
BEGIN
    -- Check if functions exist
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'toggle_video_like' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: toggle_video_like function exists';
    ELSE
        RAISE NOTICE 'Error: toggle_video_like function missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'user_has_liked_video' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: user_has_liked_video function exists';
    ELSE
        RAISE NOTICE 'Error: user_has_liked_video function missing';
    END IF;
    
    -- Check if video_likes table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_likes' AND table_schema = 'public') THEN
        RAISE NOTICE 'Success: video_likes table exists';
    ELSE
        RAISE NOTICE 'Error: video_likes table missing';
    END IF;
END $$;