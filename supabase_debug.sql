-- Debug for Supabase/PostgreSQL

-- Check if tables exist by trying to select from them
SELECT 'follows table exists' as check_result;
SELECT COUNT(*) as follows_count FROM follows;

SELECT 'profiles table exists' as check_result;
SELECT COUNT(*) as profiles_count FROM profiles;

SELECT 'system_notifications table exists' as check_result;
SELECT COUNT(*) as system_notifications_count FROM system_notifications;

-- Check recent follows to see the structure
SELECT 'Recent follows structure:' as check_result;
SELECT * FROM follows LIMIT 1;

-- Check profiles structure
SELECT 'Profiles structure:' as check_result;
SELECT * FROM profiles LIMIT 1;

-- Try to manually create a test notification to see if the table works
INSERT INTO system_notifications (to_user_id, from_user_id, type, title, message)
SELECT 
  (SELECT user_id FROM profiles LIMIT 1),
  (SELECT user_id FROM profiles LIMIT 1 OFFSET 1),
  'test',
  'Test Notification',
  'This is a test notification'
WHERE (SELECT COUNT(*) FROM profiles) >= 2;

-- Check if the test notification was created
SELECT 'Test notification created:' as check_result;
SELECT * FROM system_notifications;