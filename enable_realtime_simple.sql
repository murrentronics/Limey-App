-- Enable real-time for videos table and add like counting functionality
-- Run this in your Supabase SQL Editor

-- Enable real-time for videos table
ALTER PUBLICATION supabase_realtime ADD TABLE videos;

-- Enable real-time for video_likes table
ALTER PUBLICATION supabase_realtime ADD TABLE video_likes;

-- Enable real-time for video_views table
ALTER PUBLICATION supabase_realtime ADD TABLE video_views;

-- Create function to increment like count
CREATE OR REPLACE FUNCTION increment_like_count(video_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE videos 
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrement like count
CREATE OR REPLACE FUNCTION decrement_like_count(video_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE videos 
  SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to increment like count when a like is added
CREATE OR REPLACE FUNCTION handle_video_like_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM increment_like_count(NEW.video_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to decrement like count when a like is removed
CREATE OR REPLACE FUNCTION handle_video_like_delete()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM decrement_like_count(OLD.video_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS video_like_insert_trigger ON video_likes;
CREATE TRIGGER video_like_insert_trigger
  AFTER INSERT ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_like_insert();

DROP TRIGGER IF EXISTS video_like_delete_trigger ON video_likes;
CREATE TRIGGER video_like_delete_trigger
  AFTER DELETE ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_like_delete();

-- Verify the setup
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('videos', 'video_likes', 'video_views')
ORDER BY tablename; 