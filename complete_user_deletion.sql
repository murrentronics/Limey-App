-- Complete user deletion function that removes all user data and unlinks wallets
-- Run this in your Supabase SQL Editor

-- Create function to completely delete a user and all their data
CREATE OR REPLACE FUNCTION fully_delete_user(user_id_to_delete UUID)
RETURNS void AS $$
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  -- Start transaction to ensure all-or-nothing deletion
  BEGIN
    -- 1. Delete wallet links first (unlink wallets)
    DELETE FROM wallet_links WHERE user_id = user_id_to_delete;
    
    -- 2. Delete user sessions
    DELETE FROM user_sessions WHERE user_id = user_id_to_delete;
    
    -- 3. Delete user settings
    DELETE FROM user_settings WHERE user_id = user_id_to_delete;
    
    -- 4. Delete videos created by this user
    DELETE FROM videos WHERE user_id = user_id_to_delete;
    
    -- 8. Delete messaging data
    -- Delete messages sent by this user
    DELETE FROM messages WHERE sender_id = user_id_to_delete;
    
    -- Delete messages received by this user
    DELETE FROM messages WHERE receiver_id = user_id_to_delete;
    
    -- Delete chats where this user is the sender
    DELETE FROM chats WHERE sender_id = user_id_to_delete;
    
    -- Delete chats where this user is the receiver
    DELETE FROM chats WHERE receiver_id = user_id_to_delete;
    
    -- Delete chat deletions
    DELETE FROM chat_deletions WHERE user_id = user_id_to_delete;
    
    -- 9. Delete financial data
    -- Delete transactions
    DELETE FROM transactions WHERE user_id = user_id_to_delete;
    
    -- Delete trincredits transactions
    DELETE FROM trincredits_transactions WHERE user_id = user_id_to_delete;
    
    -- Delete gift transactions (sent)
    DELETE FROM gift_transactions WHERE sender_id = user_id_to_delete;
    
    -- Delete gift transactions (received)
    DELETE FROM gift_transactions WHERE receiver_id = user_id_to_delete;
    
    -- 10. Delete TTPayPal related data
    DELETE FROM ttpaypal_users WHERE user_id = user_id_to_delete;
    DELETE FROM ttpaypal_wallets WHERE user_id = user_id_to_delete;
    
    -- 11. Delete live streaming data
    DELETE FROM live_streams WHERE user_id = user_id_to_delete;
    
    -- 12. Delete ad-related data
    DELETE FROM ad_views WHERE user_id = user_id_to_delete;
    
    -- 13. Delete profile data
    DELETE FROM profiles WHERE user_id = user_id_to_delete;
    
    -- 14. Finally delete from auth.users (this will cascade to any remaining references)
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
    -- Log the deletion (optional - you might want to keep a record)
    -- INSERT INTO user_deletion_log (deleted_user_id, deleted_at) VALUES (user_id_to_delete, NOW());
    
  EXCEPTION WHEN OTHERS THEN
    -- If any error occurs, rollback the transaction
    RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to unlink wallet only (for partial operations)
CREATE OR REPLACE FUNCTION unlink_user_wallet(user_id_to_unlink UUID)
RETURNS void AS $$
BEGIN
  -- Set search_path for security
  PERFORM set_config('search_path', 'public', true);
  
  -- Delete wallet links
  DELETE FROM wallet_links WHERE user_id = user_id_to_unlink;
  
  -- Delete TTPayPal related data
  DELETE FROM ttpaypal_users WHERE user_id = user_id_to_unlink;
  DELETE FROM ttpaypal_wallets WHERE user_id = user_id_to_unlink;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION fully_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_user_wallet(UUID) TO authenticated;