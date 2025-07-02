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

-- Create storage policies for video uploads
CREATE POLICY "Anyone can view uploaded videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'video-uploads');

CREATE POLICY "Authenticated users can upload videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'video-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'video-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'video-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);