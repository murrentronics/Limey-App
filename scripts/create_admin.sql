-- Script to create admin account
-- This should be run after the admin user is created through normal signup

-- Update the profile to make it admin (replace 'admin@limeytt.com' with actual admin email)
UPDATE profiles 
SET is_admin = true, 
    updated_at = NOW()
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email = 'admin@limeytt.com'
);

-- Verify admin was created
SELECT 
    u.email,
    p.username,
    p.display_name,
    p.is_admin,
    p.created_at
FROM auth.users u
JOIN profiles p ON u.id = p.user_id
WHERE p.is_admin = true;