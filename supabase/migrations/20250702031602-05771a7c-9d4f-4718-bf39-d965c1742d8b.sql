-- Create storage bucket for media uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('limey-media', 'limey-media', true);

-- Create storage policies for media uploads
CREATE POLICY "Users can upload their own media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'limey-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Media files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'limey-media');

CREATE POLICY "Users can update their own media" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'limey-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'limey-media' AND auth.uid()::text = (storage.foldername(name))[1]);