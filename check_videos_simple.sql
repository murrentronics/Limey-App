-- Simple check of videos table
SELECT COUNT(*) as total_videos FROM videos;

-- Show first few videos
SELECT * FROM videos LIMIT 3;

-- Test the exact query that Feed.tsx uses
SELECT *, like_count FROM videos ORDER BY created_at DESC LIMIT 3;