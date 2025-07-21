-- Apply this SQL in your Supabase SQL Editor to fix the 404 error
-- This creates the missing record_video_view function

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

-- 2. Add view_count column to videos table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'view_count' AND table_schema = 'public') THEN
        ALTER TABLE videos ADD COLUMN view_count INTEGER DEFAULT 0 NOT NULL;
    END IF;
END $$;

-- 3. Enable Row Level Security on video_views
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for video_views
DROP POLICY IF EXISTS "video_views_select" ON video_views;
DROP POLICY IF EXISTS "video_views_insert" ON video_views;
DROP POLICY IF EXISTS "video_views_delete" ON video_views;

CREATE POLICY "video_views_select" ON video_views FOR SELECT USING (true);
CREATE POLICY "video_views_insert" ON video_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "video_views_delete" ON video_views FOR DELETE USING (auth.uid() = viewer_id);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewer_id ON video_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_video_views_creator_id ON video_views(creator_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video_viewer ON video_views(video_id, viewer_id);

-- 6. Create function to update view count
CREATE OR REPLACE FUNCTION update_video_view_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE videos SET view_count = view_count + 1 WHERE id = NEW.video_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE videos SET view_count = GREATEST(view_count - 1, 0) WHERE id = OLD.video_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create triggers
DROP TRIGGER IF EXISTS video_views_insert_trigger ON video_views;
DROP TRIGGER IF EXISTS video_views_delete_trigger ON video_views;

CREATE TRIGGER video_views_insert_trigger
    AFTER INSERT ON video_views
    FOR EACH ROW EXECUTE FUNCTION update_video_view_count();

CREATE TRIGGER video_views_delete_trigger
    AFTER DELETE ON video_views
    FOR EACH ROW EXECUTE FUNCTION update_video_view_count();

-- 8. Create the missing record_video_view function
CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    video_creator_id UUID;
    view_recorded BOOLEAN := FALSE;
BEGIN
    current_user_id := auth.uid();
    
    -- Get video creator ID
    SELECT user_id INTO video_creator_id FROM videos WHERE id = video_uuid;
    
    IF video_creator_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Handle anonymous users
    IF current_user_id IS NULL THEN
        INSERT INTO video_views (video_id, viewer_id, creator_id)
        VALUES (video_uuid, gen_random_uuid(), video_creator_id);
        RETURN TRUE;
    END IF;
    
    -- Handle authenticated users (prevent self-views and duplicates)
    IF current_user_id != video_creator_id THEN
        INSERT INTO video_views (video_id, viewer_id, creator_id)
        VALUES (video_uuid, current_user_id, video_creator_id)
        ON CONFLICT (video_id, viewer_id) DO NOTHING;
        
        GET DIAGNOSTICS view_recorded = ROW_COUNT;
        RETURN view_recorded > 0;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant permissions
GRANT SELECT, INSERT, DELETE ON video_views TO authenticated;
GRANT SELECT ON video_views TO anon;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_video_view(UUID) TO anon;

-- 10. Initialize view counts for existing videos
UPDATE videos SET view_count = COALESCE(view_count, 0) WHERE view_count IS NULL;

-- Success message
SELECT 'Views system setup complete! The record_video_view function is now available.' as status;