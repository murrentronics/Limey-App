-- Fix upload permissions and policies

-- 1. Check what tables exist and their permissions
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
AND tablename LIKE '%user%'
ORDER BY schemaname, tablename;

-- 2. Check current RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 3. Ensure profiles table has proper RLS policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow users to view all profiles
CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Check if profiles table exists and its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- 6. Ensure videos table has proper permissions for upload
GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO authenticated;
GRANT SELECT ON videos TO anon;

-- 7. Check auth.users table (this might be the issue)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'auth'
LIMIT 5;