-- Fix the foreign key relationship for live_streams
ALTER TABLE live_streams 
ADD CONSTRAINT live_streams_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Add foreign key for videos table  
ALTER TABLE videos 
ADD CONSTRAINT videos_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Create storage bucket for videos if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('video-uploads', 'video-uploads', true)
ON CONFLICT (id) DO NOTHING;