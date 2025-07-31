import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useUnreadCount = () => {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [systemUnreadCount, setSystemUnreadCount] = useState(0);

  const fetchUnreadCounts = async () => {
    if (!user) return;

    try {
      // Get unread messages count
      const { data: unreadMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('read_by_receiver', false)
        .eq('deleted_for_receiver', false)
        .eq('deleted_for_everyone', false);

      // Get unread system notifications count
      const { data: unreadNotifications, error: notificationsError } = await supabase
        .from('system_notifications')
        .select('id')
        .eq('to_user_id', user.id)
        .eq('read', false);

      if (!messagesError && !notificationsError) {
        const messagesCount = unreadMessages?.length || 0;
        const notificationsCount = unreadNotifications?.length || 0;
        const total = messagesCount + notificationsCount;

        console.log('Unread counts:', { messagesCount, notificationsCount, total });
        setInboxUnreadCount(messagesCount);
        setSystemUnreadCount(notificationsCount);
        setTotalUnreadCount(total);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCounts();

      // Set up periodic refresh to ensure counts stay accurate
      const refreshInterval = setInterval(() => {
        fetchUnreadCounts();
      }, 10000); // Refresh every 10 seconds for more responsive updates

      // Refresh counts when user comes back to the tab
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchUnreadCounts();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Set up real-time subscriptions
      const messagesSubscription = supabase
        .channel(`unread_messages_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, () => {
          setInboxUnreadCount(prev => prev + 1);
          setTotalUnreadCount(prev => prev + 1);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          // Handle message read status updates
          if (payload.new.read_by_receiver && !payload.old.read_by_receiver) {
            // Refresh counts instead of decrementing to handle bulk updates
            setTimeout(() => fetchUnreadCounts(), 100);
          }
        })
        .subscribe();

      const notificationsSubscription = supabase
        .channel(`unread_notifications_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
          filter: `to_user_id=eq.${user.id}`
        }, () => {
          setSystemUnreadCount(prev => prev + 1);
          setTotalUnreadCount(prev => prev + 1);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_notifications',
          filter: `to_user_id=eq.${user.id}`
        }, (payload) => {
          // Handle notification read status updates
          if (payload.new.read && !payload.old.read) {
            // Refresh counts to ensure accuracy
            setTimeout(() => fetchUnreadCounts(), 100);
          }
        })
        .subscribe();

      return () => {
        clearInterval(refreshInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        messagesSubscription.unsubscribe();
        notificationsSubscription.unsubscribe();
      };
    }
  }, [user]);

  return {
    totalUnreadCount,
    inboxUnreadCount,
    systemUnreadCount,
    refreshCounts: fetchUnreadCounts
  };
};