-- Fix video like counting triggers
-- Run this in your Supabase SQL Editor

-- Drop existing triggers first
DROP TRIGGER IF EXISTS video_like_insert_trigger ON video_likes;
DROP TRIGGER IF EXISTS video_like_delete_trigger ON video_likes;

-- Drop existing functions
DROP FUNCTION IF EXISTS handle_video_like_insert();
DROP FUNCTION IF EXISTS handle_video_like_delete();
DROP FUNCTION IF EXISTS increment_like_count(UUID);
DROP FUNCTION IF EXISTS decrement_like_count(UUID);

-- Create improved function to increment like count
CREATE OR REPLACE FUNCTION increment_like_count(video_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE videos 
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved function to decrement like count
CREATE OR REPLACE FUNCTION decrement_like_count(video_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE videos 
  SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
  WHERE id = video_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved trigger to increment like count when a like is added
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

-- Create improved trigger to decrement like count when a like is removed
CREATE OR REPLACE FUNCTION handle_video_like_delete()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM decrement_like_count(OLD.video_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER video_like_insert_trigger
  AFTER INSERT ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_like_insert();

CREATE TRIGGER video_like_delete_trigger
  AFTER DELETE ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_like_delete();

-- Verify the triggers are created
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('video_like_insert_trigger', 'video_like_delete_trigger')
ORDER BY trigger_name; 