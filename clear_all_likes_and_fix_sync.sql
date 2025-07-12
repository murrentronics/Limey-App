-- Clear all likes and fix synchronization issues
-- Run this in your Supabase SQL Editor

-- 1. Clear all likes from video_likes table
DELETE FROM video_likes;

-- 2. Reset all like counts in videos table to 0
UPDATE videos SET like_count = 0;

-- 3. Drop existing triggers to prevent conflicts
DROP TRIGGER IF EXISTS video_like_insert_trigger ON video_likes;
DROP TRIGGER IF EXISTS video_like_delete_trigger ON video_likes;

-- 4. Drop existing functions
DROP FUNCTION IF EXISTS handle_video_like_insert();
DROP FUNCTION IF EXISTS handle_video_like_delete();
DROP FUNCTION IF EXISTS increment_like_count(UUID);
DROP FUNCTION IF EXISTS decrement_like_count(UUID);

-- 5. Create improved functions for like counting
CREATE OR REPLACE FUNCTION increment_like_count(video_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE videos 
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_like_count(video_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE videos 
  SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create improved trigger functions
CREATE OR REPLACE FUNCTION handle_video_like_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if this is a new like (not a duplicate)
  IF NOT EXISTS (
    SELECT 1 FROM video_likes 
    WHERE video_id = NEW.video_id 
    AND user_id = NEW.user_id 
    AND id != NEW.id
  ) THEN
    PERFORM increment_like_count(NEW.video_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_video_like_delete()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM decrement_like_count(OLD.video_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 7. Create triggers
CREATE TRIGGER video_like_insert_trigger
  AFTER INSERT ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_like_insert();

CREATE TRIGGER video_like_delete_trigger
  AFTER DELETE ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_like_delete();

-- 8. Enable real-time for all relevant tables (with error handling)
DO $$
BEGIN
  -- Try to add videos table to real-time publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE videos;
  EXCEPTION
    WHEN duplicate_object THEN
      -- Table is already in publication, ignore error
      NULL;
  END;
  
  -- Try to add video_likes table to real-time publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE video_likes;
  EXCEPTION
    WHEN duplicate_object THEN
      -- Table is already in publication, ignore error
      NULL;
  END;
  
  -- Try to add video_views table to real-time publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE video_views;
  EXCEPTION
    WHEN duplicate_object THEN
      -- Table is already in publication, ignore error
      NULL;
  END;
END $$;

-- 9. Verify the cleanup
SELECT 
  'video_likes' as table_name,
  COUNT(*) as row_count
FROM video_likes
UNION ALL
SELECT 
  'videos' as table_name,
  COUNT(*) as row_count
FROM videos
UNION ALL
SELECT 
  'videos with likes > 0' as table_name,
  COUNT(*) as row_count
FROM videos WHERE like_count > 0; 