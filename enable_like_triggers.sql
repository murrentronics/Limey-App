-- Enable the update_video_like_count trigger
ALTER TABLE video_likes ENABLE TRIGGER update_video_like_count;

-- Verify that the trigger is enabled
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled
FROM 
    pg_trigger
WHERE 
    tgname = 'update_video_like_count';