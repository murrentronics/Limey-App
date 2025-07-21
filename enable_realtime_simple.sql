-- Enable realtime for video_views table

-- Enable realtime replication for video_views table
ALTER PUBLICATION supabase_realtime ADD TABLE video_views;

-- Also enable realtime for video_likes if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE video_likes;

-- Enable realtime for follows table if not already enabled  
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- Verify realtime is enabled
SELECT 
    schemaname,
    tablename,
    'Realtime Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('video_views', 'video_likes', 'follows', 'videos')
ORDER BY tablename;