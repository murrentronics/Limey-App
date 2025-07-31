-- Test remove follower functionality

-- Check current follows for a specific user (replace with actual user IDs)
SELECT 'Current follows:' as test;
SELECT 
  f.*,
  follower.username as follower_username,
  following.username as following_username
FROM follows f
LEFT JOIN profiles follower ON follower.user_id = f.follower_id
LEFT JOIN profiles following ON following.user_id = f.following_id
ORDER BY f.created_at DESC
LIMIT 10;

-- Test delete query (replace with actual user IDs)
-- DELETE FROM follows 
-- WHERE follower_id = 'follower-user-id-here' 
-- AND following_id = 'following-user-id-here';

-- Check if any constraints or triggers might be preventing deletion
SELECT 'Constraints on follows table:' as test;
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'follows'::regclass;