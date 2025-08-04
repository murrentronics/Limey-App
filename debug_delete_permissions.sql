-- Debug delete permissions and constraints

-- Check RLS policies on follows table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'follows';

-- Check if RLS is enabled on follows table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'follows';

-- Test a simple delete with current user context (replace with actual IDs)
-- This will help us see if the delete works at all
SELECT 'Testing delete permissions...' as test;

-- Check current user context
SELECT 
  current_user as current_user,
  session_user as session_user;

-- Check if we can see the follows we want to delete
SELECT 'Follows that should be deletable:' as test;
SELECT * FROM follows 
WHERE follower_id IN (
  SELECT user_id FROM profiles LIMIT 5
) 
LIMIT 5;

-- Test delete with a specific example (replace with actual user IDs)
-- DELETE FROM follows 
-- WHERE follower_id = 'actual-follower-id' 
-- AND following_id = 'actual-following-id';

SELECT 'Debug complete' as result;