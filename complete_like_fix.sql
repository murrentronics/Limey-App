-- Function to check if a user has liked a specific video
CREATE OR REPLACE FUNCTION public.check_user_liked_video(video_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  like_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM video_likes
    WHERE video_id = video_uuid
    AND user_id = user_uuid
  ) INTO like_exists;
  
  RETURN like_exists;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_liked_video(UUID, UUID) TO authenticated;

-- Add comment to function
COMMENT ON FUNCTION public.check_user_liked_video IS 'Checks if a specific user has liked a specific video';

-- Function to toggle a like on a video
CREATE OR REPLACE FUNCTION public.toggle_video_like(video_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_has_liked BOOLEAN;
  current_user_id UUID;
BEGIN
  -- Get the current user ID from auth.uid()
  current_user_id := auth.uid();
  
  -- Check if the user has already liked this video
  SELECT EXISTS (
    SELECT 1
    FROM video_likes
    WHERE video_id = video_uuid
    AND user_id = current_user_id
  ) INTO user_has_liked;
  
  IF user_has_liked THEN
    -- User already liked the video, so remove the like
    DELETE FROM video_likes
    WHERE video_id = video_uuid
    AND user_id = current_user_id;
    
    -- Update the like count in the videos table
    UPDATE videos
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = video_uuid;
    
    RETURN FALSE; -- User no longer likes the video
  ELSE
    -- User hasn't liked the video, so add a like
    INSERT INTO video_likes (video_id, user_id)
    VALUES (video_uuid, current_user_id);
    
    -- Update the like count in the videos table
    UPDATE videos
    SET like_count = like_count + 1
    WHERE id = video_uuid;
    
    RETURN TRUE; -- User now likes the video
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_video_like(UUID) TO authenticated;

-- Add comment to function
COMMENT ON FUNCTION public.toggle_video_like IS 'Toggles a like on a video for the current user';

-- Create a trigger to update like_count when likes are added or removed directly
CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment like count
    UPDATE videos
    SET like_count = like_count + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement like count
    UPDATE videos
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create the trigger on the video_likes table
DROP TRIGGER IF EXISTS update_video_like_count_trigger ON video_likes;
CREATE TRIGGER update_video_like_count_trigger
AFTER INSERT OR DELETE ON video_likes
FOR EACH ROW
EXECUTE FUNCTION update_video_like_count();