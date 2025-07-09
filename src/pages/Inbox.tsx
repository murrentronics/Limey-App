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
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchChats();
      const cleanup = subscribeToChats();
      return cleanup;
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
        console.log('Raw chats data:', data);
        
        // Filter out chats that the current user has deleted
        const filteredChats = (data || []).filter(chat => {
          const isDeletedForUser = 
            (chat.sender_id === user?.id && chat.deleted_for_sender) ||
            (chat.receiver_id === user?.id && chat.deleted_for_receiver);
          return !isDeletedForUser;
        });
        
        console.log('Filtered chats:', filteredChats);
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
        const newChat = payload.new;
        
        // Only add if current user is involved
        if (newChat.sender_id === user?.id || newChat.receiver_id === user?.id) {
          setChats(prev => {
            // Check if chat already exists to avoid duplicates
            const exists = prev.some(chat => chat.id === newChat.id);
            if (exists) return prev;
            
            // Fetch the complete chat data with profiles
            fetchChats(); // Refresh to get complete data
            return prev;
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
        event: 'DELETE',
        schema: 'public',
        table: 'chats'
      }, (payload) => {
        console.log('Chat deleted:', payload.old);
        setChats(prev => prev.filter(chat => chat.id !== payload.old.id));
      })
      .subscribe((status) => {
        console.log('Chats subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time chats');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error in chats subscription');
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
        toast({
          title: "Delete failed",
          description: "Unable to delete chat",
          variant: "destructive"
        });
      } else {
        setChats(chats.filter(chat => chat.id !== chatId));
        toast({
          title: "Chat deleted",
          description: "Chat has been removed from your inbox"
        });
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Delete failed",
        description: "Unable to delete chat",
        variant: "destructive"
      });
    }
    setShowMenu(null);
  };

  const handleOpenChat = (chatId: string) => {
    navigate(`/chat/${chatId}`);
    setShowMenu(null);
  };

  const handleRefresh = () => {
    fetchChats();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold">Messages</h1>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
              onClick={handleRefresh}
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
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
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
