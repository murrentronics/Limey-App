-- Check authentication status and user data

-- 1. Check if auth.uid() returns anything
SELECT 
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN '❌ Not authenticated'
        ELSE '✅ Authenticated'
    END as auth_status;

-- 2. Check if there are any users in auth.users
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as users_with_email
FROM auth.users;

-- 3. Show sample users (without sensitive data)
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 3;

-- 4. Check if there are profiles for these users
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as profiles_with_username
FROM profiles;

-- 5. Test inserting with a specific user ID (if users exist)
-- First, let's see what user IDs are available
SELECT 
    'Available user IDs:' as info,
    id as user_id
FROM auth.users 
LIMIT 3;