-- Add sent_to_username column to system_notifications table
-- This will store the actual username for individual notifications instead of parsing from message

ALTER TABLE system_notifications 
ADD COLUMN IF NOT EXISTS sent_to_username TEXT;

-- Create index for better performance on the new column
CREATE INDEX IF NOT EXISTS idx_system_notifications_sent_to_username 
ON system_notifications(sent_to_username);

-- Update existing individual notifications to extract username from message
UPDATE system_notifications 
SET sent_to_username = (
  CASE 
    WHEN message ~ '^\[TO:([^\]]+)\]' THEN 
      substring(message from '^\[TO:([^\]]+)\]')
    ELSE NULL
  END
)
WHERE type IN ('admin', 'admin_tracking') 
AND message ~ '^\[TO:([^\]]+)\]';

-- Verify the update
SELECT 
  id,
  type,
  message,
  sent_to_username,
  created_at
FROM system_notifications 
WHERE type IN ('admin', 'admin_tracking')
ORDER BY created_at DESC
LIMIT 10;