-- Add some test videos for development (replace with real data)
-- Note: You'll need to replace the UUIDs and URLs with real values

-- First, let's see if there are any users to associate videos with
SELECT id, email FROM auth.users LIMIT 3;

-- If you have users, you can uncomment and modify this:
/*
INSERT INTO videos (
    id,
    title,
    description,
    video_url,
    thumbnail_url,
    user_id,
    category,
    view_count,
    like_count,
    created_at
) VALUES 
(
    gen_random_uuid(),
    'Test Video 1',
    'This is a test video for development',
    'https://example.com/video1.mp4',
    'https://example.com/thumb1.jpg',
    'YOUR_USER_ID_HERE', -- Replace with actual user ID
    'Comedy',
    0,
    0,
    NOW()
),
(
    gen_random_uuid(),
    'Test Video 2', 
    'Another test video',
    'https://example.com/video2.mp4',
    'https://example.com/thumb2.jpg',
    'YOUR_USER_ID_HERE', -- Replace with actual user ID
    'Music',
    0,
    0,
    NOW()
);
*/