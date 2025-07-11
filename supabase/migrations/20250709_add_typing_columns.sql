-- Migration to add typing_sender and typing_receiver columns to chats
ALTER TABLE chats
ADD COLUMN IF NOT EXISTS typing_sender BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS typing_receiver BOOLEAN DEFAULT FALSE; 