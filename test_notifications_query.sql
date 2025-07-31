-- Test the notifications query that the frontend is using

-- Check what notifications exist
SELECT 'All system notifications:' as test;
SELECT * FROM system_notifications ORDER BY created_at DESC;

-- Test the join with profiles (this is what the frontend is trying to do)
SELECT 'Notifications with profile join:' as test;
SELECT 
  sn.*,
  p.username,
  p.avatar_url
FROM system_notifications sn
LEFT JOIN profiles p ON p.user_id = sn.from_user_id
ORDER BY sn.created_at DESC;

-- Check if there are any notifications for a specific user (replace with your user ID)
SELECT 'Notifications for specific user:' as test;
SELECT * FROM system_notifications 
WHERE to_user_id = '6360d3fb-7deb-4850-9a70-9a6d45a07220'  -- replace with your user ID
ORDER BY created_at DESC;