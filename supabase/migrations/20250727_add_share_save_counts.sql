-- Add share_count and save_count columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_share_count ON videos(share_count);
CREATE INDEX IF NOT EXISTS idx_videos_save_count ON videos(save_count);

-- Create function to increment share count
CREATE OR REPLACE FUNCTION increment_share_count(video_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE videos 
    SET share_count = COALESCE(share_count, 0) + 1
    WHERE id = video_uuid;
    
    SELECT share_count INTO new_count
    FROM videos 
    WHERE id = video_uuid;
    
    RETURN COALESCE(new_count, 0);
END;
$$;

-- Create function to get save count for a video
CREATE OR REPLACE FUNCTION get_save_count(video_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM saved_videos
    WHERE video_id = video_uuid;
    
    RETURN COALESCE(count_result, 0);
END;
$$;

-- Create trigger to update save_count when saved_videos changes
CREATE OR REPLACE FUNCTION update_video_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE videos 
        SET save_count = (
            SELECT COUNT(*) 
            FROM saved_videos 
            WHERE video_id = NEW.video_id
        )
        WHERE id = NEW.video_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE videos 
        SET save_count = (
            SELECT COUNT(*) 
            FROM saved_videos 
            WHERE video_id = OLD.video_id
        )
        WHERE id = OLD.video_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Create triggers for save count updates
DROP TRIGGER IF EXISTS trigger_update_save_count_insert ON saved_videos;
DROP TRIGGER IF EXISTS trigger_update_save_count_delete ON saved_videos;

CREATE TRIGGER trigger_update_save_count_insert
    AFTER INSERT ON saved_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_video_save_count();

CREATE TRIGGER trigger_update_save_count_delete
    AFTER DELETE ON saved_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_video_save_count();

-- Initialize save counts for existing videos
UPDATE videos 
SET save_count = (
    SELECT COUNT(*) 
    FROM saved_videos 
    WHERE saved_videos.video_id = videos.id
)
WHERE save_count IS NULL OR save_count = 0;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION increment_share_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_save_count(UUID) TO authenticated;