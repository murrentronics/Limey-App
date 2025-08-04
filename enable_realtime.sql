-- Ensure realtime is enabled for all social feature tables

-- 1. Check current realtime publications
SELECT 
    schemaname,
    tablename,
    'Currently enabled for realtime' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('video_likes', 'video_views', 'videos', 'follows')
ORDER BY tablename;

-- 2. Enable realtime for video_likes if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE video_likes;

-- 3. Enable realtime for video_views if not already enabled  
ALTER PUBLICATION supabase_realtime ADD TABLE video_views;

-- 4. Enable realtime for videos table (for like_count updates)
ALTER PUBLICATION supabase_realtime ADD TABLE videos;

-- 5. Enable realtime for follows table
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- 6. Verify all tables are now enabled
SELECT 
    schemaname,
    tablename,
    'Realtime enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('video_likes', 'video_views', 'videos', 'follows')
ORDER BY tablename;