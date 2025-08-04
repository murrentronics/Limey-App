-- First, let's check all existing functions and triggers related to likes
SELECT 
    n.nspname as schema,
    p.proname as function_name
FROM 
    pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE 
    p.proname LIKE '%like%' OR
    p.proname LIKE '%toggle%' OR
    p.proname LIKE '%update%count%';

-- Check all triggers related to likes
SELECT 
    tgname as trigger_name,
    relname as table_name,
    tgenabled
FROM 
    pg_trigger
WHERE 
    (tgname LIKE '%like%' OR tgname LIKE '%count%' OR tgname LIKE '%update%')
    AND tgisinternal = false; -- Only show non-system triggers

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.toggle_video_like(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_video_like_count() CASCADE;
DROP FUNCTION IF EXISTS public.check_user_liked_video(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_like_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.decrement_like_count(UUID) CASCADE;

-- Reset all like counts to ensure consistency
UPDATE videos SET like_count = 0;

-- Delete all existing likes to start fresh
DELETE FROM video_likes;

-- Create a clean implementation of the toggle_video_like function
-- This function will handle both the like/unlike action and the count update
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

-- Create a function to check if a user has liked a video
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

-- Drop any user-defined triggers on video_likes table
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'video_likes'::regclass 
        AND tgisinternal = false -- Only drop non-system triggers
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_rec.tgname || ' ON video_likes';
    END LOOP;
END $$;

-- Re-enable RLS on the video_likes table
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to like any video
DROP POLICY IF EXISTS video_likes_insert_policy ON video_likes;
CREATE POLICY video_likes_insert_policy ON video_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow users to unlike their own likes
DROP POLICY IF EXISTS video_likes_delete_policy ON video_likes;
CREATE POLICY video_likes_delete_policy ON video_likes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create policy to allow users to see all likes
DROP POLICY IF EXISTS video_likes_select_policy ON video_likes;
CREATE POLICY video_likes_select_policy ON video_likes
  FOR SELECT
  TO authenticated
  USING (true);

-- Recalculate like counts for all videos
UPDATE videos v
SET like_count = (
  SELECT COUNT(*)
  FROM video_likes vl
  WHERE vl.video_id = v.id
);

-- Add comment to functions
COMMENT ON FUNCTION public.toggle_video_like IS 'Toggles a like on a video for the current user and updates the like count';
COMMENT ON FUNCTION public.check_user_liked_video IS 'Checks if a specific user has liked a specific video';