import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../integrations/supabase/client';

type ChatWithUnread = { unread_count_receiver: number };

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unopenedChatsCount, setUnopenedChatsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnopenedChatsCount = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Count chats where the user is the receiver and there are unread messages
      const { data, error } = await supabase
        .from('chats')
        .select('id, unread_count_receiver')
        .eq('receiver_id', user.id);

      if (error) {
        console.error('Error fetching chats count:', error);
        return;
      }

      // Count chats with unread_count_receiver > 0
      if (Array.isArray(data) && data.every(chat => 'unread_count_receiver' in chat)) {
        const unopenedCount = (data as ChatWithUnread[])
          .filter(chat => chat.unread_count_receiver && chat.unread_count_receiver > 0).length;
        setUnopenedChatsCount(unopenedCount);
      } else {
        setUnopenedChatsCount(0);
      }
    } catch (error) {
      console.error('Error fetching unopened chats count:', error);
    } finally {
      setLoading(false);
    }
  };

  const markChatAsRead = async (chatId: string) => {
    if (!user) return;

    try {
      // For now, we'll just refetch the count
      // This will be replaced with proper mark as read logic
      fetchUnopenedChatsCount();
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnopenedChatsCount();
      
      // Subscribe to real-time updates for better responsiveness
      const subscription = supabase
        .channel('unread_messages_realtime')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          console.log('Chat updated for receiver:', payload.new);
          // Immediately refetch unopened chats count when chats are updated
          fetchUnopenedChatsCount();
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chats',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          console.log('New chat created for receiver:', payload.new);
          // Immediately refetch unopened chats count when new chats are created
          fetchUnopenedChatsCount();
        })
        .subscribe((status) => {
          console.log('Unread messages subscription status:', status);
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  return {
    unopenedChatsCount,
    loading,
    fetchUnopenedChatsCount,
    markChatAsRead
  };
}; 