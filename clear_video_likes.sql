-- Clear all likes to test the fixed system
DELETE FROM video_likes;
UPDATE videos SET like_count = 0;

SELECT 'All likes cleared - test the system now' as status;