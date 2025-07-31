-- Fix RLS policy for follows table to allow removing followers

-- Drop existing delete policy
DROP POLICY IF EXISTS "Users can delete their own follows" ON follows;
DROP POLICY IF EXISTS "Users can delete follows" ON follows;

-- Create new delete policy that allows:
-- 1. Users to delete follows where they are the follower (unfollow someone)
-- 2. Users to delete follows where they are being followed (remove a follower)
CREATE POLICY "Users can delete follows they created or followers" ON follows
  FOR DELETE USING (
    auth.uid() = follower_id OR auth.uid() = following_id
  );

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'follows' AND cmd = 'DELETE';