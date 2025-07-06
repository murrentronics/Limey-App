-- Add video views tracking table
-- This tracks genuine views from other users (excludes creator views)

-- Create views table to track individual video views
CREATE TABLE IF NOT EXISTS public.video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(video_id, viewer_id) -- Prevent duplicate views from same user
);

-- Enable RLS
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Views are viewable by everyone" ON public.video_views FOR SELECT USING (true);
CREATE POLICY "Users can insert their own views" ON public.video_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "Users can delete their own views" ON public.video_views FOR DELETE USING (auth.uid() = viewer_id);

-- Create function to record a view
CREATE OR REPLACE FUNCTION record_video_view(video_uuid UUID)
RETURNS void AS $$
DECLARE
  video_creator_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get video creator ID
  SELECT user_id INTO video_creator_id 
  FROM public.videos 
  WHERE id = video_uuid;
  
  -- Only record view if viewer is not the creator
  IF current_user_id IS NOT NULL AND video_creator_id IS NOT NULL AND current_user_id != video_creator_id THEN
    INSERT INTO public.video_views (video_id, viewer_id, creator_id)
    VALUES (video_uuid, current_user_id, video_creator_id)
    ON CONFLICT (video_id, viewer_id) DO NOTHING; -- Ignore duplicate views
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get genuine view count (excluding creator views)
CREATE OR REPLACE FUNCTION get_genuine_view_count(video_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM public.video_views
  WHERE video_id = video_uuid;
  
  RETURN COALESCE(view_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update video view count
CREATE OR REPLACE FUNCTION update_video_view_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the view_count in videos table with genuine count
  UPDATE public.videos 
  SET view_count = get_genuine_view_count(NEW.video_id)
  WHERE id = NEW.video_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update view count when views are added
CREATE TRIGGER update_video_view_count_trigger
  AFTER INSERT ON public.video_views
  FOR EACH ROW
  EXECUTE FUNCTION update_video_view_count();

-- Create trigger to update view count when views are deleted
CREATE TRIGGER update_video_view_count_delete_trigger
  AFTER DELETE ON public.video_views
  FOR EACH ROW
  EXECUTE FUNCTION update_video_view_count();

-- Update existing videos to have correct view counts (set to 0 initially)
UPDATE public.videos SET view_count = 0 WHERE view_count IS NULL; 