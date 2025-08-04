-- Fix performance and RLS issues by removing duplicate policies
-- Run this in your Supabase SQL Editor

-- 1. Fix video_likes table (currently has 9 policies, should have 3)
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow users to access their own video likes" ON video_likes;
DROP POLICY IF EXISTS "Users can create their own likes" ON video_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON video_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON video_likes;
DROP POLICY IF EXISTS "Users can like videos" ON video_likes;
DROP POLICY IF EXISTS "Users can unlike their own likes" ON video_likes;
DROP POLICY IF EXISTS "Users can view all likes" ON video_likes;
DROP POLICY IF EXISTS "Users can view all video likes" ON video_likes;
DROP POLICY IF EXISTS "Video likes are viewable by everyone" ON video_likes;

-- Create 3 optimized policies for video_likes
CREATE POLICY "video_likes_insert" ON video_likes
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "video_likes_delete" ON video_likes
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "video_likes_select" ON video_likes
  FOR SELECT USING (true);

-- 2. Fix chats table (currently has 9 policies, should have 4)
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow users to access their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete chats they are part of" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;
DROP POLICY IF EXISTS "Users can insert chats they are part of" ON chats;
DROP POLICY IF EXISTS "Users can manage their chats" ON chats;
DROP POLICY IF EXISTS "Users can update chats they are part of" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view chats they are part of" ON chats;
DROP POLICY IF EXISTS "Users can view non-deleted chats" ON chats;

-- Create 4 optimized policies for chats
CREATE POLICY "chats_select" ON chats
  FOR SELECT USING (
    ((SELECT auth.uid()) = sender_id AND deleted_for_sender = false) OR 
    ((SELECT auth.uid()) = receiver_id AND deleted_for_receiver = false)
  );

CREATE POLICY "chats_insert" ON chats
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = sender_id);

CREATE POLICY "chats_update" ON chats
  FOR UPDATE USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id);

CREATE POLICY "chats_delete" ON chats
  FOR DELETE USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id);

-- 3. Fix messages table (currently has 6 policies, should have 4)
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow users to access their own messages" ON messages;
DROP POLICY IF EXISTS "Users can manage their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages they sent" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;

-- Create 4 optimized policies for messages
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    deleted_for_everyone = false AND
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND (
        (chats.sender_id = (SELECT auth.uid()) AND chats.deleted_for_sender = false) OR 
        (chats.receiver_id = (SELECT auth.uid()) AND chats.deleted_for_receiver = false)
      )
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = sender_id AND
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND (
        (chats.sender_id = (SELECT auth.uid()) AND chats.deleted_for_sender = false) OR 
        (chats.receiver_id = (SELECT auth.uid()) AND chats.deleted_for_receiver = false)
      )
    )
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING ((SELECT auth.uid()) = sender_id AND deleted_for_everyone = false);

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING ((SELECT auth.uid()) = sender_id);

-- 4. Fix profiles table (currently has 5 policies, should have 3)
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow users to access their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create 3 optimized policies for profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- 5. Fix comments table (currently has 6 policies, should have 4)
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow users to access their own comments" ON comments;
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;

-- Create 4 optimized policies for comments
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert" ON comments
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "comments_update" ON comments
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "comments_delete" ON comments
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- 6. Fix wallet_links table (currently has 6 policies, should have 3)
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow all select" ON wallet_links;
DROP POLICY IF EXISTS "Allow authenticated insert" ON wallet_links;
DROP POLICY IF EXISTS "Allow authenticated select" ON wallet_links;
DROP POLICY IF EXISTS "Allow user delete" ON wallet_links;
DROP POLICY IF EXISTS "Allow user insert" ON wallet_links;
DROP POLICY IF EXISTS "Allow user select" ON wallet_links;

-- Create 3 optimized policies for wallet_links
CREATE POLICY "wallet_links_select" ON wallet_links
  FOR SELECT USING (true);

CREATE POLICY "wallet_links_insert" ON wallet_links
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "wallet_links_delete" ON wallet_links
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- 7. Fix other tables with duplicate policies

-- Fix ad_views (3 policies -> 2)
DROP POLICY IF EXISTS "Ad views are viewable by everyone" ON ad_views;
DROP POLICY IF EXISTS "Allow users to access their own ad views" ON ad_views;
DROP POLICY IF EXISTS "Users can create ad views" ON ad_views;

CREATE POLICY "ad_views_select" ON ad_views FOR SELECT USING (true);
CREATE POLICY "ad_views_insert" ON ad_views FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Fix ads (2 policies -> 1)
DROP POLICY IF EXISTS "Ads are viewable by everyone" ON ads;
DROP POLICY IF EXISTS "Allow users to access all ads" ON ads;

CREATE POLICY "ads_select" ON ads FOR SELECT USING (true);

-- Fix gift_transactions (3 policies -> 2)
DROP POLICY IF EXISTS "Allow users to access their own gift transactions" ON gift_transactions;
DROP POLICY IF EXISTS "Gift transactions are viewable by sender and receiver" ON gift_transactions;
DROP POLICY IF EXISTS "Users can send gifts" ON gift_transactions;

CREATE POLICY "gift_transactions_select" ON gift_transactions
  FOR SELECT USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id);

CREATE POLICY "gift_transactions_insert" ON gift_transactions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = sender_id);

-- Fix transactions (3 policies -> 2)
DROP POLICY IF EXISTS "Allow users to access their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;

CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_likes_user_video ON video_likes(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_video_id ON video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_ad_views_ad_id ON ad_views(ad_id);
CREATE INDEX IF NOT EXISTS idx_chat_deletions_user_id ON chat_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_gift_id ON gift_transactions(gift_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_user_id ON live_streams(user_id);

-- 9. Remove duplicate indexes
DROP INDEX IF EXISTS idx_chats_last_activity;  -- Keep idx_chats_updated_at
DROP INDEX IF EXISTS follows_follower_id_idx;  -- Keep idx_follows_follower_id
DROP INDEX IF EXISTS follows_following_id_idx; -- Keep idx_follows_following_id

-- 10. Verify the fixes
SELECT 'RLS Policy Cleanup Completed!' as status;

-- Check video_likes policies (should be 3)
SELECT 'video_likes' as table_name, COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'video_likes' AND schemaname = 'public'
UNION ALL
-- Check chats policies (should be 4)
SELECT 'chats' as table_name, COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'chats' AND schemaname = 'public'
UNION ALL
-- Check messages policies (should be 4)
SELECT 'messages' as table_name, COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'messages' AND schemaname = 'public';