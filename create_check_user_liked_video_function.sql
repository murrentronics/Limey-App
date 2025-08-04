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