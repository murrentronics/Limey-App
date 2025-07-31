-- Debug follow notifications

-- 1. Check if the trigger exists
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'create_follow_notification_trigger';

-- 2. Check if the function exists
SELECT 
    routine_name, 
    routine_type, 
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'create_follow_notification';

-- 3. Check the structure of the follows table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'follows'
ORDER BY ordinal_position;

-- 4. Check the structure of the profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. Check if there are any follows records
SELECT COUNT(*) as follows_count FROM follows;

-- 6. Check recent follows (replace with actual user IDs if you know them)
SELECT * FROM follows ORDER BY created_at DESC LIMIT 5;

-- 7. Check if profiles have the expected structure
SELECT COUNT(*) as profiles_count FROM profiles;

-- 8. Test manual notification creation (replace with actual user IDs)
-- INSERT INTO system_notifications (to_user_id, from_user_id, type, title, message)
-- VALUES ('user-id-1', 'user-id-2', 'test', 'Test Notification', 'This is a test');

-- 9. Check current system notifications
SELECT * FROM system_notifications ORDER BY created_at DESC;