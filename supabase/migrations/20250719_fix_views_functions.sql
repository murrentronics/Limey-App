-- Fix missing views system functions
-- This ensures all functions for the views system are properly created

-- 1. Create the user_has_viewed_video function
CREATE OR REPLACE FUNCTION user_has_viewed_video(video_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    -- Return false for anonymous users
    IF user_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS(
        SELECT 1 FROM video_views 
        WHERE video_id = video_uuid AND viewer_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure record_video_view function exists and works properly
CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    video_creator_id UUID;
    view_recorded BOOLEAN := FALSE;
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    -- Get current user
    current_user_id := auth.uid();
    
    -- Allow anonymous views (for non-authenticated users)
    IF current_user_id IS NULL THEN
        -- For anonymous users, we can't prevent duplicate views
        -- Get video creator ID
        SELECT user_id INTO video_creator_id 
        FROM videos 
        WHERE id = video_uuid;
        
        IF video_creator_id IS NOT NULL THEN
            -- Create a temporary UUID for anonymous user
            INSERT INTO video_views (video_id, viewer_id, creator_id)
            VALUES (video_uuid, gen_random_uuid(), video_creator_id);
            view_recorded := TRUE;
        END IF;
    ELSE
        -- For authenticated users, prevent duplicate views and self-views
        SELECT user_id INTO video_creator_id 
        FROM videos 
        WHERE id = video_uuid;
        
        -- Only record view if viewer is not the creator
        IF video_creator_id IS NOT NULL AND current_user_id != video_creator_id THEN
            INSERT INTO video_views (video_id, viewer_id, creator_id)
            VALUES (video_uuid, current_user_id, video_creator_id)
            ON CONFLICT (video_id, viewer_id) DO NOTHING;
            
            -- Check if the insert actually happened (not a duplicate)
            GET DIAGNOSTICS view_recorded = ROW_COUNT;
            view_recorded := view_recorded > 0;
        END IF;
    END IF;
    
    RETURN view_recorded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure get_genuine_view_count function exists
CREATE OR REPLACE FUNCTION get_genuine_view_count(video_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    view_count INTEGER;
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    SELECT COUNT(*) INTO view_count
    FROM video_views
    WHERE video_id = video_uuid;
    
    RETURN COALESCE(view_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure update_video_view_count trigger function exists
CREATE OR REPLACE FUNCTION update_video_view_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    IF TG_OP = 'INSERT' THEN
        -- Increment view count
        UPDATE videos 
        SET view_count = view_count + 1
        WHERE id = NEW.video_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement view count (ensure it doesn't go below 0)
        UPDATE videos 
        SET view_count = GREATEST(view_count - 1, 0)
        WHERE id = OLD.video_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure triggers exist
DROP TRIGGER IF EXISTS video_views_insert_trigger ON video_views;
DROP TRIGGER IF EXISTS video_views_delete_trigger ON video_views;

CREATE TRIGGER video_views_insert_trigger
    AFTER INSERT ON video_views
    FOR EACH ROW
    EXECUTE FUNCTION update_video_view_count();

CREATE TRIGGER video_views_delete_trigger
    AFTER DELETE ON video_views
    FOR EACH ROW
    EXECUTE FUNCTION update_video_view_count();

-- 6. Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON video_views TO authenticated;
GRANT SELECT ON video_views TO anon;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_genuine_view_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_genuine_view_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION user_has_viewed_video(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_viewed_video(UUID) TO authenticated;

-- 7. Verification
DO $$
BEGIN
    -- Check if functions exist
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'record_video_view' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: record_video_view function exists';
    ELSE
        RAISE NOTICE 'Error: record_video_view function missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'user_has_viewed_video' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: user_has_viewed_video function exists';
    ELSE
        RAISE NOTICE 'Error: user_has_viewed_video function missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_genuine_view_count' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: get_genuine_view_count function exists';
    ELSE
        RAISE NOTICE 'Error: get_genuine_view_count function missing';
    END IF;
    
    -- Check if video_views table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_views' AND table_schema = 'public') THEN
        RAISE NOTICE 'Success: video_views table exists';
    ELSE
        RAISE NOTICE 'Error: video_views table missing';
    END IF;
END $$;