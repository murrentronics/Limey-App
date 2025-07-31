import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MoreVertical, Trash2, MessageSquare, Bell, Heart, Shield, UserPlus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/hooks/use-toast";
import { useUnreadCount } from "@/hooks/useUnreadCount";

const Inbox = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemLoading, setSystemLoading] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [chatId: string]: number }>({});
  const { inboxUnreadCount, systemUnreadCount, refreshCounts } = useUnreadCount();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deleteChat';
    chatId: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchChats();
      fetchSystemNotifications(); // Fetch system notifications on load
      const cleanup = subscribeToChats();
      const systemCleanup = subscribeToSystemNotifications();

      return () => {
        cleanup();
        systemCleanup();
      };
    }
  }, [user]);

  // Fetch unread counts for individual chats
  const fetchChatUnreadCounts = async () => {
    if (!user || chats.length === 0) return;
    await fetchChatUnreadCountsForChats(chats);
  };

  const fetchChatUnreadCountsForChats = async (chatList: any[]) => {
    if (!user || chatList.length === 0) return;
    
    try {
      const chatIds = chatList.map(chat => chat.id);
      const { data: unreadData, error } = await supabase
        .from('messages')
        .select('chat_id')
        .in('chat_id', chatIds)
        .eq('receiver_id', user.id)
        .eq('read_by_receiver', false)
        .eq('deleted_for_receiver', false)
        .eq('deleted_for_everyone', false);

      if (error) {
        console.error('Error fetching chat unread counts:', error);
        return;
      }

      // Count unread messages per chat
      const counts: { [chatId: string]: number } = {};
      unreadData?.forEach(msg => {
        counts[msg.chat_id] = (counts[msg.chat_id] || 0) + 1;
      });

      console.log('Chat unread counts:', counts);
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error fetching chat unread counts:', error);
    }
  };

  // Fetch system notifications
  const fetchSystemNotifications = async () => {
    if (!user) return;
    
    try {
      setSystemLoading(true);
      // First try with join
      let { data, error } = await supabase
        .from('system_notifications')
        .select(`
          *,
          from_user:profiles!inner(username, avatar_url)
        `)
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // If join fails, try without join and fetch profiles separately
      if (error) {
        console.log('Join failed, trying without join:', error);
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('system_notifications')
          .select('*')
          .eq('to_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!notificationsError && notificationsData) {
          // Fetch profiles separately
          const userIds = notificationsData.map(n => n.from_user_id).filter(Boolean);
          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('user_id, username, avatar_url')
              .in('user_id', userIds);

            // Combine the data
            data = notificationsData.map(notification => ({
              ...notification,
              from_user: profilesData?.find(p => p.user_id === notification.from_user_id) || null
            }));
          } else {
            data = notificationsData;
          }
          error = null;
        } else {
          error = notificationsError;
        }
      }

      if (error) {
        console.error('Error fetching system notifications:', error);
      } else {
        console.log('Fetched system notifications:', data);
        setSystemNotifications(data || []);
        // Refresh counts after loading notifications
        refreshCounts();
      }
    } catch (error) {
      console.error('Error fetching system notifications:', error);
    } finally {
      setSystemLoading(false);
    }
  };



  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper to get the last visible message for the current user
  // Remove getLastVisibleMessage helper

  // Revert fetchChats to only fetch last_message as before
  const fetchChats = async () => {
    try {
      setLoading(true);
      // Fetch chats where current user is either sender or receiver
      const { data, error } = await (supabase as any)
        .from('chats')
        .select(`*,
          sender:profiles!chats_sender_id_fkey(username, avatar_url, deactivated),
          receiver:profiles!chats_receiver_id_fkey(username, avatar_url, deactivated)
        `)
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('updated_at', { ascending: false });
  
      if (error) {
        console.error('Error fetching chats:', error);
        toast({
          title: 'Error loading chats',
          description: 'Please try refreshing the page',
          variant: 'destructive',
        });
      } else {
        // Filter out chats that the current user has deleted or where users are deactivated
        const filteredChats = (data || []).filter((chat: any) => {
          // Filter out chats with deactivated users
          if (chat.sender?.deactivated || chat.receiver?.deactivated) {
            return false;
          }
  
          // Filter out chats that the current user has deleted
          if ((chat.sender_id === user?.id && chat.deleted_for_sender) ||
            (chat.receiver_id === user?.id && chat.deleted_for_receiver)) {
            return false;
          }
  
          return true;
        });
  
        console.log('Filtered chats:', filteredChats.length, 'out of', data?.length || 0);
        setChats(filteredChats);
  
        // For each chat, fetch the latest visible message for the current user
        const chatIds = filteredChats.map((chat: any) => chat.id);
        let lastMessages = [];
        if (chatIds.length > 0) {
          // Fetch up to 5 recent messages per chat (to handle edge cases)
          const { data: messagesData, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .in('chat_id', chatIds)
            .order('created_at', { ascending: false })
            .limit(chatIds.length * 5);
          if (!messagesError && messagesData) {
            lastMessages = messagesData;
          }
        }
        // Attach last visible message to each chat
        const chatsWithLastVisible = filteredChats.map((chat: any) => {
          // Find the latest message for this chat that is visible to the user
          const messages = lastMessages.filter((m: any) => m.chat_id === chat.id);
          let lastVisible = null;
          for (const msg of messages) {
            const isOwn = msg.sender_id === user?.id;
            const isDeletedForEveryone = msg.deleted_for_everyone === true;
            const isDeletedForSender = isOwn && msg.deleted_for_sender === true;
            const isDeletedForReceiver = !isOwn && msg.deleted_for_receiver === true;
            if (!isDeletedForEveryone && !isDeletedForSender && !isDeletedForReceiver) {
              lastVisible = msg;
              break;
            }
          }
          return { ...chat, last_visible_message: lastVisible };
        });
        setChats(chatsWithLastVisible);
        
        // Fetch chat-specific unread counts after chats are loaded
        if (chatsWithLastVisible.length > 0) {
          setTimeout(() => {
            fetchChatUnreadCountsForChats(chatsWithLastVisible);
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: 'Error loading chats',
        description: 'Please try refreshing the page',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const subscribeToChats = () => {
    console.log('Setting up real-time subscription for chats');

    const subscription = supabase
      .channel(`chats_${user?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats'
      }, async (payload) => {
        console.log('New chat created:', payload.new);
        // Only add the chat if it's not deleted for the current user and not already in the list
        setChats(prev => {
          const exists = prev.some(chat => chat.id === payload.new.id);
          if (exists) return prev;
          const isDeletedForUser =
            (payload.new.sender_id === user?.id && payload.new.deleted_for_sender) ||
            (payload.new.receiver_id === user?.id && payload.new.deleted_for_receiver);
          if (isDeletedForUser) return prev;
          // Add a placeholder while we fetch the full chat
          return [payload.new, ...prev];
        });

        // Fetch the full chat with profile data
        const { data: fullChat, error } = await supabase
          .from('chats')
          .select(`
            *,
            sender:profiles!chats_sender_id_fkey(username, avatar_url),
            receiver:profiles!chats_receiver_id_fkey(username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (fullChat) {
          setChats(prev => {
            // Replace the placeholder with the full chat object
            const filtered = prev.filter(chat => chat.id !== fullChat.id);
            return [fullChat, ...filtered];
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats'
      }, (payload) => {
        console.log('Chat updated:', payload.new);
        const updatedChat = payload.new;

        // Only process if current user is involved
        if (updatedChat.sender_id === user?.id || updatedChat.receiver_id === user?.id) {
          setChats(prev => {
            // If the chat was marked as deleted for the current user, remove it immediately
            const isDeletedForUser =
              (updatedChat.sender_id === user?.id && updatedChat.deleted_for_sender) ||
              (updatedChat.receiver_id === user?.id && updatedChat.deleted_for_receiver);

            if (isDeletedForUser) {
              console.log('Removing deleted chat from UI:', updatedChat.id);
              return prev.filter(chat => chat.id !== updatedChat.id);
            }

            // Update existing chat or add if not exists
            const existingIndex = prev.findIndex(chat => chat.id === updatedChat.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              // Preserve profile data from existing chat
              updated[existingIndex] = {
                ...updated[existingIndex],
                ...updatedChat
              };

              // Sort by updated_at to keep most recent chats at top
              return updated.sort((a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              );
            } else {
              // New chat, refresh to get complete data
              fetchChats();
              return prev;
            }
          });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`
      }, async (payload) => {
        console.log('New message received:', payload.new);
        // Increment unread count for this chat
        setUnreadCounts(prev => ({
          ...prev,
          [payload.new.chat_id]: (prev[payload.new.chat_id] || 0) + 1
        }));
        
        console.log('New message received, updated unread counts');

        // Update the last message for this chat
        await updateLastMessageForChat(payload.new.chat_id);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`
      }, async (payload) => {
        // Handle message read status updates
        if (payload.new.read_by_receiver && !payload.old.read_by_receiver) {
          // Message was marked as read
          setUnreadCounts(prev => ({
            ...prev,
            [payload.new.chat_id]: Math.max(0, (prev[payload.new.chat_id] || 0) - 1)
          }));
          
          // Also refresh counts to ensure accuracy
          setTimeout(() => refreshCounts(), 100);
          console.log('Message marked as read, updated counts');
        }
      })
      .subscribe((status) => {
        console.log('Chats subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time chats and messages');
        }
      });

    return () => {
      console.log('Cleaning up chats subscription');
      subscription.unsubscribe();
    };
  };

  const subscribeToSystemNotifications = () => {
    console.log('Setting up real-time subscription for system notifications');

    const subscription = supabase
      .channel(`system_notifications_${user?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_notifications',
        filter: `to_user_id=eq.${user?.id}`
      }, async (payload) => {
        console.log('New system notification received:', payload.new);
        
        // Fetch the complete notification with user data
        const { data: fullNotification, error } = await supabase
          .from('system_notifications')
          .select(`
            *,
            from_user:profiles(username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (fullNotification && !error) {
          // Add to the beginning of the notifications list
          setSystemNotifications(prev => [fullNotification, ...prev]);
          
          // Show toast notification for follow notifications
          if (fullNotification.type === 'follow') {
            toast({
              title: "New Follower!",
              description: `${fullNotification.from_user?.username || 'Someone'} started following you`,
              className: 'bg-blue-600 text-white border-blue-700'
            });
          } else if (fullNotification.type === 'like') {
            toast({
              title: "Video Liked!",
              description: fullNotification.message,
              className: 'bg-red-600 text-white border-red-700'
            });
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'system_notifications',
        filter: `to_user_id=eq.${user?.id}`
      }, (payload) => {
        console.log('System notification updated:', payload.new);
        
        // Update the notification in the list
        setSystemNotifications(prev => 
          prev.map(notif => 
            notif.id === payload.new.id 
              ? { ...notif, ...payload.new }
              : notif
          )
        );
        
        // Refresh counts if read status changed
        if (payload.new.read !== payload.old.read) {
          refreshCounts();
        }
      })
      .subscribe((status) => {
        console.log('System notifications subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time system notifications');
        }
      });

    return () => {
      console.log('Cleaning up system notifications subscription');
      subscription.unsubscribe();
    };
  };

  const updateLastMessageForChat = async (chatId: string) => {
    try {
      // Fetch the latest visible message for this chat
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !messages) return;

      // Find the latest visible message for the current user
      let lastVisible = null;
      for (const msg of messages) {
        const isOwn = msg.sender_id === user?.id;
        const isDeletedForEveryone = msg.deleted_for_everyone === true;
        const isDeletedForSender = isOwn && msg.deleted_for_sender === true;
        const isDeletedForReceiver = !isOwn && msg.deleted_for_receiver === true;
        if (!isDeletedForEveryone && !isDeletedForSender && !isDeletedForReceiver) {
          lastVisible = msg;
          break;
        }
      }

      // Update the chat with the new last message
      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, last_visible_message: lastVisible }
          : chat
      ));
    } catch (error) {
      console.error('Error updating last message for chat:', error);
    }
  };

  const getChatPartner = (chat: any) => {
    if (!chat || !user) return null;

    if (chat.sender_id === user.id) {
      return chat.receiver;
    } else {
      return chat.sender;
    }
  };

  const getLastMessage = (chat: any) => {
    const msg = chat.last_visible_message;
    if (!msg) {
      return "No messages yet";
    }
    if (msg.content === '' || msg.content == null) {
      return "Message deleted";
    }
    // Truncate long messages
    if (msg.content.length > 50) {
      return msg.content.substring(0, 50) + "...";
    }
    return msg.content;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return "now";
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    // Find the chat to determine which field to update
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    if (chat.sender_id !== user?.id) {
      toast({
        title: 'Not allowed',
        description: 'Only the creator of the chat can delete.',
        variant: 'destructive'
      });
      setShowMenu(null);
      return;
    }

    // Show confirmation dialog
    setConfirmAction({
      type: 'deleteChat',
      chatId: chatId
    });
    setShowConfirmDialog(true);
    setShowMenu(null);
  };

  const handleOpenChat = async (chatId: string) => {
    // Clear unread count immediately for better UX
    setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
    
    // Navigate immediately for better UX
    navigate(`/chat/${chatId}`);
    setShowMenu(null);
    
    // Mark messages as read in the background
    try {
      const { error } = await supabase.rpc('mark_messages_as_read', {
        chat_id_param: chatId,
        user_id_param: user?.id
      });

      if (!error) {
        // Refresh counts after marking messages as read
        setTimeout(() => refreshCounts(), 200);
      } else {
        console.error('Error marking messages as read:', error);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const confirmDeleteChat = async () => {
    if (!user || !confirmAction) return;

    try {
      const { chatId } = confirmAction;

      // Find the chat to determine which field to update
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;
      if (chat.sender_id !== user?.id) {
        toast({
          title: 'Not allowed',
          description: 'Only the creator of the chat can delete.',
          variant: 'destructive'
        });
        return;
      }

      console.log('Deleting chat:', chatId);

      // Immediately remove from UI for better user experience
      setChats(prev => prev.filter(c => c.id !== chatId));

      // Sender deletes for both users
      const { error } = await supabase
        .from('chats')
        .update({
          deleted_for_sender: true,
          deleted_for_receiver: true,
          // Add a timestamp to ensure the update is recognized
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) {
        console.error('Error deleting chat:', error);
        // Fetch chats again to restore the UI if there was an error
        fetchChats();
        toast({
          title: 'Failed to delete chat',
          description: error.message || 'Please try again.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Chat deleted',
          description: 'The chat has been removed from both inboxes.',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: 'Failed to delete chat',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      });
    } finally {
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };





  // Handle notification click
  const handleNotificationClick = async (notification: any) => {
    // Mark as read first
    await markNotificationAsRead(notification.id);
    
    // Handle different notification types
    if (notification.type === 'follow' && notification.from_user?.username) {
      // Navigate to the follower's profile
      navigate(`/profile/${notification.from_user.username}`);
    } else if (notification.type === 'like' && notification.from_user?.username) {
      // Navigate to the liker's profile
      navigate(`/profile/${notification.from_user.username}`);
    }
    // Add more notification type handlers as needed
  };

  // Mark system notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('system_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (!error) {
        setSystemNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, read: true }
              : notif
          )
        );
        
        // Refresh counts after marking as read
        refreshCounts();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={16} className="text-red-400" />;
      case 'follow':
        return <UserPlus size={16} className="text-blue-400" />;
      case 'admin':
        return <Shield size={16} className="text-yellow-400" />;
      default:
        return <Bell size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <span
            className="text-2xl font-black text-white tracking-wider logo-text-glow"
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: '900',
              letterSpacing: '0.15em',
              filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
            }}
          >
            Messages
          </span>
          <div style={{ width: 40 }}></div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="pt-20 pb-24">
        <Tabs defaultValue="inbox" className="w-full">
          <TabsList className="grid grid-cols-2 mx-4 mb-4 max-w-md">
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <MessageSquare size={16} />
              Inbox
              {inboxUnreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold ml-1">
                  {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2" onClick={fetchSystemNotifications}>
              <Bell size={16} />
              System
              {systemUnreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold ml-1">
                  {systemUnreadCount > 99 ? '99+' : systemUnreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Inbox Tab */}
          <TabsContent value="inbox">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={24} />
                </div>
                <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                <p className="text-white/70 mb-4">
                  Start a conversation with someone!
                </p>
                <Button
                  variant="outline"
                  onClick={fetchChats}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {chats.map((chat) => {
                  const partner = getChatPartner(chat);
                  if (!partner) return null;

                  return (
                    <div
                      key={chat.id}
                      className="flex items-center p-4 border-b border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => handleOpenChat(chat.id)}
                    >
                      {/* Avatar */}
                      <div className="relative mr-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={partner.avatar_url} alt={partner.username} />
                          <AvatarFallback className="bg-white/10 text-white">
                            {partner.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Unread message count badge */}
                        {unreadCounts[chat.id] > 0 && (
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold">
                            {unreadCounts[chat.id] > 99 ? '99+' : unreadCounts[chat.id]}
                          </div>
                        )}
                      </div>

                      {/* Chat Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-white truncate">
                            @{partner.username || 'unknown'}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60 flex-shrink-0">
                              {formatTime(chat.updated_at)}
                            </span>
                            {/* Blue dot for unread messages */}
                            {unreadCounts[chat.id] > 0 && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-white/70 truncate">
                          {getLastMessage(chat)}
                        </p>
                      </div>

                      {/* Three Dots Menu */}
                      <div className="relative ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(showMenu === chat.id ? null : chat.id);
                          }}
                          className="text-white/60 hover:text-white p-2"
                        >
                          <MoreVertical size={16} />
                        </Button>

                        {/* Dropdown Menu */}
                        {showMenu === chat.id && (
                          <div className="absolute top-full right-0 mt-2 bg-black/90 rounded-lg shadow-lg z-10 min-w-[140px] border border-white/10" data-dropdown>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenChat(chat.id);
                              }}
                            >
                              <MessageSquare size={14} />
                              Open Chat
                            </button>
                            {chat.sender_id === user?.id ? (
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400 flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChat(chat.id);
                                }}
                              >
                                <Trash2 size={14} />
                                Delete Chat
                              </button>
                            ) : (
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400 flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({
                                    title: 'Not allowed',
                                    description: 'Only the creator of the chat can delete.',
                                    variant: 'destructive'
                                  });
                                  setShowMenu(null);
                                }}
                              >
                                <Trash2 size={14} />
                                Delete Chat
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* System Notifications Tab */}
          <TabsContent value="system">
            {systemLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : systemNotifications.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell size={24} />
                </div>
                <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                <p className="text-white/70">
                  System notifications will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {systemNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-center p-4 border-b border-white/10 hover:bg-white/5 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="mr-3">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    {notification.from_user && (
                      <div className="relative mr-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={notification.from_user.avatar_url} alt={notification.from_user.username} />
                          <AvatarFallback className="bg-white/10 text-white">
                            {notification.from_user.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-white truncate">
                          {notification.title}
                        </h3>
                        <span className="text-xs text-white/60 flex-shrink-0 ml-2">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">
                        {notification.message}
                      </p>
                    </div>

                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>


        </Tabs>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="bg-black/90 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Are you sure you want to delete this chat?
            </h3>
            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteChat}
                variant="destructive"
                className="flex-1"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Inbox;
