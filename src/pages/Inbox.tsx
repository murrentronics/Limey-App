import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MoreVertical, Trash2, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/hooks/use-toast";

const Inbox = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [chatId: string]: number }>({});
  const [lastChecked, setLastChecked] = useState<{ [chatId: string]: string }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchChats();
      const cleanup = subscribeToChats();
      
      // Start periodic checking for new messages
      const interval = setInterval(() => {
        checkForNewMessages();
      }, 10000); // Check every 10 seconds
      
      // Initial check for unread messages after a short delay
      const initialCheck = setTimeout(() => {
        checkForNewMessages();
      }, 2000);
      
      return () => {
        cleanup();
        clearInterval(interval);
        clearTimeout(initialCheck);
      };
    }
  }, [user]);

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

  const fetchChats = async () => {
    try {
      setLoading(true);
      console.log('Fetching chats for user:', user?.id);
      
      // Fetch chats where current user is either sender or receiver
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          sender:profiles!chats_sender_id_fkey(username, avatar_url),
          receiver:profiles!chats_receiver_id_fkey(username, avatar_url)
        `)
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching chats:', error);
        toast({
          title: "Error loading chats",
          description: "Please try refreshing the page",
          variant: "destructive"
        });
      } else {
        console.log('Raw chats from database:', data);
        // Filter out chats that the current user has deleted
        const filteredChats = (data || []).filter(chat => {
          const isDeletedForUser = 
            (chat.sender_id === user?.id && chat.deleted_for_sender) ||
            (chat.receiver_id === user?.id && chat.deleted_for_receiver);
          return !isDeletedForUser;
        });
        console.log('Filtered chats for inbox:', filteredChats);
        setChats(filteredChats);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: "Error loading chats",
        description: "Please try refreshing the page",
        variant: "destructive"
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
      }, (payload) => {
        console.log('New chat created:', payload.new);
        setChats(prev => {
          // Check if chat already exists to avoid duplicates
          const exists = prev.some(chat => chat.id === payload.new.id);
          if (exists) return prev;
          
          // Only add the chat if it's not deleted for the current user
          const isDeletedForUser = 
            (payload.new.sender_id === user?.id && payload.new.deleted_for_sender) ||
            (payload.new.receiver_id === user?.id && payload.new.deleted_for_receiver);
          
          if (isDeletedForUser) {
            console.log('Not adding deleted chat to inbox:', payload.new.id);
            return prev;
          }
          
          // Check if user already has an active chat with the same person
          const otherUserId = payload.new.sender_id === user?.id ? payload.new.receiver_id : payload.new.sender_id;
          const hasActiveChatWithSamePerson = prev.some(chat => {
            const chatOtherUserId = chat.sender_id === user?.id ? chat.receiver_id : chat.sender_id;
            return chatOtherUserId === otherUserId;
          });
          
          if (hasActiveChatWithSamePerson) {
            console.log('Not adding new chat - user already has active chat with same person:', payload.new.id);
            return prev;
          }
          
          // Special case: If this is a new chat and the current user is the receiver,
          // and they have a non-deleted chat with the sender, don't add this new chat
          // because the sender should be using the existing chat
          if (payload.new.receiver_id === user?.id) {
            const existingChatWithSender = prev.find(chat => {
              const chatOtherUserId = chat.sender_id === user?.id ? chat.receiver_id : chat.sender_id;
              return chatOtherUserId === payload.new.sender_id;
            });
            
            if (existingChatWithSender) {
              console.log('Not adding new chat - receiver already has active chat with sender:', payload.new.id);
              return prev;
            }
          }
          
          console.log('Adding new chat to inbox:', payload.new.id);
          return [payload.new, ...prev];
        });
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
            // If the chat was marked as deleted for the current user, remove it
            const isDeletedForUser = 
              (updatedChat.sender_id === user?.id && updatedChat.deleted_for_sender) ||
              (updatedChat.receiver_id === user?.id && updatedChat.deleted_for_receiver);
            
            if (isDeletedForUser) {
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
      }, (payload) => {
        console.log('New message received:', payload.new);
        // Increment unread count for this chat
        setUnreadCounts(prev => ({
          ...prev,
          [payload.new.chat_id]: (prev[payload.new.chat_id] || 0) + 1
        }));
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

  const getChatPartner = (chat: any) => {
    if (!chat || !user) return null;
    
    if (chat.sender_id === user.id) {
      return chat.receiver;
    } else {
      return chat.sender;
    }
  };

  const getLastMessage = (chat: any) => {
    if (!chat.last_message) {
      return "No messages yet";
    }
    
    // Truncate long messages
    if (chat.last_message.length > 50) {
      return chat.last_message.substring(0, 50) + "...";
    }
    
    return chat.last_message;
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
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    try {
      // Find the chat to determine which field to update
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;
      
      // Mark chat as deleted for the current user instead of actually deleting it
      const updateField = chat.sender_id === user?.id ? 'deleted_for_sender' : 'deleted_for_receiver';
      const { error } = await supabase
        .from('chats')
        .update({ [updateField]: true })
        .eq('id', chatId);
      
      if (error) {
        console.error('Error deleting chat:', error);
        alert('Failed to delete chat: ' + error.message);
      } else {
        setChats(chats.filter(chat => chat.id !== chatId));
        // Show success feedback
        const originalText = document.title;
        document.title = 'Chat deleted!';
        setTimeout(() => {
          document.title = originalText;
        }, 1000);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert('Failed to delete chat: An unexpected error occurred');
    }
    setShowMenu(null);
  };

  const handleOpenChat = (chatId: string) => {
    // Clear unread count when opening chat
    setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
    setLastChecked(prev => ({ ...prev, [chatId]: new Date().toISOString() }));
    navigate(`/chat/${chatId}`);
    setShowMenu(null);
  };

  const checkForNewMessages = async () => {
    if (!user || chats.length === 0) return;
    
    try {
      const chatIds = chats.map(chat => chat.id);
      
      // Get the last message timestamp for each chat
      const { data: lastMessages, error } = await supabase
        .from('messages')
        .select('chat_id, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false })
        .limit(chatIds.length * 10); // Get recent messages for all chats
      
      if (error) {
        console.error('Error checking for new messages:', error);
        return;
      }
      
      // Group messages by chat and find the latest message for each
      const latestMessages = new Map();
      lastMessages?.forEach(message => {
        if (!latestMessages.has(message.chat_id) || 
            new Date(message.created_at) > new Date(latestMessages.get(message.chat_id))) {
          latestMessages.set(message.chat_id, message.created_at);
        }
      });
      
      // Update unread counts
      const newUnreadCounts: { [chatId: string]: number } = {};
      const newLastChecked: { [chatId: string]: string } = {};
      
      chats.forEach(chat => {
        const lastMessageTime = latestMessages.get(chat.id);
        const lastCheckedTime = lastChecked[chat.id];
        
        if (lastMessageTime && (!lastCheckedTime || new Date(lastMessageTime) > new Date(lastCheckedTime))) {
          // Count unread messages since last check
          const unreadCount = lastMessages?.filter(msg => 
            msg.chat_id === chat.id && 
            new Date(msg.created_at) > new Date(lastCheckedTime || '1970-01-01')
          ).length || 0;
          
          newUnreadCounts[chat.id] = unreadCount;
        } else {
          newUnreadCounts[chat.id] = unreadCounts[chat.id] || 0;
        }
        
        newLastChecked[chat.id] = lastMessageTime || lastCheckedTime || new Date().toISOString();
      });
      
      setUnreadCounts(newUnreadCounts);
      setLastChecked(newLastChecked);
      
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Messages</h1>
            {Object.values(unreadCounts).reduce((total, count) => total + count, 0) > 0 && (
              <div className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-[20px] flex items-center justify-center font-bold">
                {Object.values(unreadCounts).reduce((total, count) => total + count, 0)}
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              console.log('=== DEBUG: Current chats state ===');
              console.log('Chats:', chats);
              console.log('User ID:', user?.id);
              fetchChats(); // Refresh chats
            }}
            className="text-white/60 hover:text-white"
          >
            🔄
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <div className="pt-20 pb-24">
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
                  onClick={() => navigate(`/chat/${chat.id}`)}
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
                      <span className="text-xs text-white/60 flex-shrink-0 ml-2">
                        {formatTime(chat.updated_at)}
                      </span>
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Inbox;
