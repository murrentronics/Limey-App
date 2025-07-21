-- Restore proper authentication and security for video uploads

-- 1. First, make user_id required again
ALTER TABLE videos ALTER COLUMN user_id SET NOT NULL;

-- 2. Drop the permissive upload policy
DROP POLICY IF EXISTS "Allow video uploads" ON videos;

-- 3. Restore proper INSERT policy that requires authentication
CREATE POLICY "Users can create their own videos" ON videos
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. Ensure UPDATE policy is also secure
DROP POLICY IF EXISTS "Users can update their own videos" ON videos;
CREATE POLICY "Users can update their own videos" ON videos
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. Ensure DELETE policy is secure
DROP POLICY IF EXISTS "Users can delete their own videos" ON videos;
CREATE POLICY "Users can delete their own videos" ON videos
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Keep SELECT policy open for viewing
DROP POLICY IF EXISTS "Users can view videos" ON videos;
CREATE POLICY "Users can view videos" ON videos
    FOR SELECT USING (true);

-- 7. Verify the policies are correct
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'videos'
ORDER BY cmd, policyname;

-- 8. Test that authenticated users can still upload
-- (This will only work if you're authenticated in the SQL editor)
SELECT 
    CASE 
        WHEN auth.uid() IS NOT NULL 
        THEN CONCAT('✅ Authenticated as: ', auth.uid())
        ELSE '❌ Not authenticated - uploads will require login'
    END as auth_status;