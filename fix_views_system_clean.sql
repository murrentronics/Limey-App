-- Fix the record_video_view function with proper search_path

-- 1. Drop the existing function
DROP FUNCTION IF EXISTS record_video_view(uuid);

-- 2. Recreate with proper search_path security
CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    video_creator_id UUID;
    view_recorded BOOLEAN := FALSE;
BEGIN
    -- Set search_path for security (this fixes the warning!)
    PERFORM set_config('search_path', 'public', true);
    
    -- Get current user
    current_user_id := auth.uid();
    
    -- Check if video exists and get creator ID
    SELECT user_id INTO video_creator_id 
    FROM videos 
    WHERE id = video_uuid;
    
    -- If video doesn't exist, return false
    IF video_creator_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Handle anonymous users
    IF current_user_id IS NULL THEN
        -- For anonymous users, always record a view with random UUID
        INSERT INTO video_views (video_id, viewer_id, creator_id)
        VALUES (video_uuid, gen_random_uuid(), video_creator_id);
        view_recorded := TRUE;
    ELSE
        -- For authenticated users, only record if not the creator
        IF current_user_id != video_creator_id THEN
            INSERT INTO video_views (video_id, viewer_id, creator_id)
            VALUES (video_uuid, current_user_id, video_creator_id)
            ON CONFLICT (video_id, viewer_id) DO NOTHING;
            
            -- Check if insert happened
            GET DIAGNOSTICS view_recorded = ROW_COUNT;
            view_recorded := view_recorded > 0;
        END IF;
    END IF;
    
    RETURN view_recorded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Also fix the toggle_video_like function while we're at it
DROP FUNCTION IF EXISTS toggle_video_like(uuid);

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
    
    -- Return false if not authenticated
    IF current_user_id IS NULL THEN
        RETURN FALSE;
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
        
        -- Decrement like count
        UPDATE videos 
        SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = video_uuid;
        
        RETURN FALSE; -- Now unliked
    ELSE
        -- Like: add the like
        INSERT INTO video_likes (video_id, user_id)
        VALUES (video_uuid, current_user_id)
        ON CONFLICT (video_id, user_id) DO NOTHING;
        
        -- Increment like count
        UPDATE videos 
        SET like_count = like_count + 1
        WHERE id = video_uuid;
        
        RETURN TRUE; -- Now liked
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO anon;
GRANT EXECUTE ON FUNCTION toggle_video_like(UUID) TO authenticated;

-- 5. Test the fixed function
SELECT 
    record_video_view((SELECT id FROM videos LIMIT 1)) as test_result,
    'Should work now with proper search_path' as note;

-- 6. Check if views are being recorded
SELECT COUNT(*) as total_views_after_fix FROM video_views;