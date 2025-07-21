-- Create the missing record_video_view function and related components

-- 1. Create video_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS video_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate views from same user on same video
    UNIQUE(video_id, viewer_id)
);

-- 2. Enable Row Level Security on video_views
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for video_views
DROP POLICY IF EXISTS "video_views_select" ON video_views;
DROP POLICY IF EXISTS "video_views_insert" ON video_views;
DROP POLICY IF EXISTS "video_views_delete" ON video_views;

-- Users can view all views (for displaying counts and analytics)
CREATE POLICY "video_views_select" ON video_views
    FOR SELECT USING (true);

-- Users can only insert their own views
CREATE POLICY "video_views_insert" ON video_views
    FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Users can delete their own views (for privacy)
CREATE POLICY "video_views_delete" ON video_views
    FOR DELETE USING (auth.uid() = viewer_id);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewer_id ON video_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_video_views_creator_id ON video_views(creator_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewed_at ON video_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_video_views_video_viewer ON video_views(video_id, viewer_id);

-- 5. Create function to update view count
CREATE OR REPLACE FUNCTION update_video_view_count()
RETURNS TRIGGER AS $$
BEGIN
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

-- 6. Create triggers to automatically update view counts
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

-- 7. Create the main function to record a video view
CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    video_creator_id UUID;
    view_recorded BOOLEAN := FALSE;
BEGIN
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

-- 8. Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON video_views TO authenticated;
GRANT SELECT ON video_views TO anon; -- Allow anonymous users to see view counts
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO anon;

-- 9. Test the function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'record_video_view' AND routine_schema = 'public') THEN
        RAISE NOTICE 'SUCCESS: record_video_view function created successfully!';
    ELSE
        RAISE NOTICE 'ERROR: record_video_view function not found';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_views' AND table_schema = 'public') THEN
        RAISE NOTICE 'SUCCESS: video_views table created successfully!';
    ELSE
        RAISE NOTICE 'ERROR: video_views table not found';
    END IF;
END $$;