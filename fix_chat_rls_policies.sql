-- Clean up duplicate and conflicting RLS policies on profiles table

-- 1. Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to access their own profile" ON profiles;

-- 2. Create clean, simple policies
-- Allow everyone to view all profiles (for public profile viewing)
CREATE POLICY "profiles_select_all" ON profiles
    FOR SELECT USING (true);

-- Allow users to insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own profile
CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Verify the clean policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- 4. Test the profile query that was failing
SELECT 
    v.*,
    p.username,
    p.avatar_url
FROM videos v
LEFT JOIN profiles p ON v.user_id = p.user_id
WHERE v.user_id = '8dfaa427-3bef-4e3b-996c-aa4349683fed'
ORDER BY v.created_at DESC
LIMIT 3;