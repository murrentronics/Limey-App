-- Add recipient_count column to system_notifications table
-- This will store the actual number of recipients when the notification is sent

ALTER TABLE system_notifications 
ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 1;

-- Create index for better performance on the new column
CREATE INDEX IF NOT EXISTS idx_system_notifications_recipient_count 
ON system_notifications(recipient_count);

-- Update existing "All Users" notifications to have a more accurate count
-- This is a one-time update for existing data
UPDATE system_notifications 
SET recipient_count = (
  SELECT COUNT(DISTINCT to_user_id) 
  FROM system_notifications s2 
  WHERE s2.message = system_notifications.message 
  AND s2.title = system_notifications.title
  AND s2.type = 'admin'
  AND s2.message ~ '^\[ALL_USERS\]'
)
WHERE type = 'admin' 
AND message ~ '^\[ALL_USERS\]';

-- Update individual notifications to have recipient_count = 1
UPDATE system_notifications 
SET recipient_count = 1
WHERE type IN ('admin', 'admin_tracking') 
AND (message ~ '^\[TO:([^\]]+)\]' OR sent_to_username IS NOT NULL);

-- Verify the update
SELECT 
  id,
  type,
  title,
  CASE 
    WHEN message ~ '^\[ALL_USERS\]' THEN 'All Users'
    WHEN message ~ '^\[TO:([^\]]+)\]' THEN 'Individual'
    ELSE 'Other'
  END as notification_type,
  recipient_count,
  created_at
FROM system_notifications 
WHERE type IN ('admin', 'admin_tracking')
ORDER BY created_at DESC
LIMIT 10;