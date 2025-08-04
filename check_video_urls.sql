-- Check video URLs to see if they're accessible

-- 1. Check video URLs and their format
SELECT 
    id,
    title,
    video_url,
    thumbnail_url,
    CASE 
        WHEN video_url LIKE 'https://%.supabase.co/storage/v1/object/public/%' THEN '✅ Valid Supabase URL'
        WHEN video_url LIKE 'https://%' THEN '⚠️ External URL'
        ELSE '❌ Invalid URL Format'
    END as url_status,
    LENGTH(video_url) as url_length
FROM videos 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check if video files actually exist in storage
-- This will show the storage path structure
SELECT 
    id,
    title,
    SUBSTRING(video_url FROM 'limeytt-uploads/(.*)') as storage_path,
    video_url
FROM videos 
WHERE video_url LIKE '%limeytt-uploads%'
ORDER BY created_at DESC 
LIMIT 3;