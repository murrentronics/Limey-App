-- Add username and avatar_url columns to videos table
-- Run this in your Supabase SQL Editor

-- Add username column to videos table
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add avatar_url column to videos table  
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update existing videos with username and avatar_url from profiles
UPDATE public.videos 
SET 
  username = profiles.username,
  avatar_url = profiles.avatar_url
FROM public.profiles 
WHERE videos.user_id = profiles.user_id;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_username ON videos(username);
CREATE INDEX IF NOT EXISTS idx_videos_avatar_url ON videos(avatar_url);

-- Verify the migration worked
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name IN ('username', 'avatar_url')
ORDER BY column_name; 