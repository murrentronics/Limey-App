-- Fix the unique constraint issue for chats
-- Run this in your Supabase SQL Editor

-- First, let's see what chats exist with the same sender/receiver
SELECT 
  sender_id, 
  receiver_id, 
  deleted_for_sender, 
  deleted_for_receiver, 
  created_at,
  id
FROM chats 
WHERE sender_id IN (
  SELECT sender_id 
  FROM chats 
  GROUP BY sender_id, receiver_id 
  HAVING COUNT(*) > 1
)
ORDER BY sender_id, receiver_id, created_at;

-- Drop the existing unique constraint
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_sender_id_receiver_id_key;
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_sender_id_key;

-- Create a new unique constraint that only applies to non-deleted chats
-- This allows multiple chats between the same users if some are deleted
CREATE UNIQUE INDEX chats_active_unique 
ON chats (sender_id, receiver_id) 
WHERE deleted_for_sender = false AND deleted_for_receiver = false;

-- Also create a reverse unique constraint for the other direction
CREATE UNIQUE INDEX chats_active_unique_reverse 
ON chats (receiver_id, sender_id) 
WHERE deleted_for_sender = false AND deleted_for_receiver = false; 