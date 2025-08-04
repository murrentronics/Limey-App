-- Remove the old restrictive follows delete policy

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "follows_delete" ON follows;

-- Verify only the correct policy remains
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'follows' AND cmd = 'DELETE';

-- Test that we can now see the follows table properly
SELECT 'Policy cleanup complete' as result;