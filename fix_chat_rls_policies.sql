-- Fix RLS policies for chat deletion
-- Run this in your Supabase SQL Editor

-- Drop all existing policies for chats
DROP POLICY IF EXISTS "Users can view chats they are part of" ON chats;
DROP POLICY IF EXISTS "Users can view chats they are part of and haven't deleted" ON chats;
DROP POLICY IF EXISTS "Users can view non-deleted chats" ON chats;
DROP POLICY IF EXISTS "Users can insert chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;

-- Create a simple SELECT policy that allows users to see chats they're part of
-- The application will handle filtering out deleted chats
CREATE POLICY "Users can view chats they are part of" ON chats
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Create UPDATE policy that allows users to update chats they're part of
CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Create INSERT policy
CREATE POLICY "Users can insert chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Create DELETE policy
CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id); 