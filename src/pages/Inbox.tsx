import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MoreVertical, Trash2, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";

const Inbox = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState<string | null>(null);

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
      } else {
        // Filter out chats that the current user has deleted
        const filteredChats = (data || []).filter(chat => {
          if (chat.sender_id === user?.id) {
            return !chat.deleted_for_sender;
          } else {
            return !chat.deleted_for_receiver;
          }
        });
        setChats(filteredChats);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChats = () => {
    const subscription = supabase
      .channel('chats_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `sender_id=eq.${user?.id} OR receiver_id=eq.${user?.id}`
      }, (payload) => {
        console.log('New chat created:', payload.new);
        setChats(prev => {
          // Check if chat already exists to avoid duplicates
          const exists = prev.some(chat => chat.id === payload.new.id);
          if (exists) return prev;
          return [payload.new, ...prev];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `sender_id=eq.${user?.id} OR receiver_id=eq.${user?.id}`
      }, (payload) => {
        console.log('Chat updated:', payload.new);
        setChats(prev => {
          // If the chat was marked as deleted for the current user, remove it
          const isDeletedForUser = 
            (payload.new.sender_id === user?.id && payload.new.deleted_for_sender) ||
            (payload.new.receiver_id === user?.id && payload.new.deleted_for_receiver);
          
          if (isDeletedForUser) {
            return prev.filter(chat => chat.id !== payload.new.id);
          }
          
          // Otherwise, update the chat
          const updated = prev.map(chat => 
            chat.id === payload.new.id ? payload.new : chat
          );
          // Sort by updated_at to keep most recent chats at top
          return updated.sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chats',
        filter: `sender_id=eq.${user?.id} OR receiver_id=eq.${user?.id}`
      }, (payload) => {
        console.log('Chat deleted:', payload.old);
        setChats(prev => prev.filter(chat => chat.id !== payload.old.id));
      })
      .subscribe((status) => {
        console.log('Chats subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time chats');
        }
      });

    return () => {
      subscription.unsubscribe();
    };
  };

  const getChatPartner = (chat: any) => {
    if (chat.sender_id === user?.id) {
      return chat.receiver;
    } else {
      return chat.sender;
    }
  };

  const getLastMessage = (chat: any) => {
    return chat.last_message || "No messages yet";
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) {
      return "now";
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) { // less than 24 hours
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
      } else {
        setChats(chats.filter(chat => chat.id !== chatId));
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
    setShowMenu(null);
  };

  const handleOpenChat = (chatId: string) => {
    navigate(`/chat/${chatId}`);
    setShowMenu(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="w-8"></div>
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
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-white/70 mb-4">
              Start a conversation with someone!
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {chats.map((chat) => {
              const partner = getChatPartner(chat);
              return (
                <div
                  key={chat.id}
                  className="flex items-center p-4 border-b border-white/10 hover:bg-white/5 cursor-pointer"
                  onClick={() => navigate(`/chat/${chat.id}`)}
                >
                  {/* Avatar */}
                  <div className="relative mr-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={partner?.avatar_url} alt={partner?.username} />
                      <AvatarFallback>{partner?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white truncate">
                        @{partner?.username || 'unknown'}
                      </h3>
                      <span className="text-xs text-white/60">
                        {formatTime(chat.updated_at)}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 truncate">
                      {getLastMessage(chat)}
                    </p>
                  </div>

                  {/* Three Dots Menu */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(showMenu === chat.id ? null : chat.id);
                      }}
                      className="text-white/60 hover:text-white"
                    >
                      <MoreVertical size={16} />
                    </Button>
                    
                    {/* Dropdown Menu */}
                    {showMenu === chat.id && (
                      <div className="absolute top-full right-0 mt-2 bg-black/90 rounded-lg shadow-lg z-10 min-w-[120px]" data-dropdown>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                          onClick={() => handleOpenChat(chat.id)}
                        >
                          <span className="text-lg" role="img" aria-label="Messages">💬</span>
                          Open Chat
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400 flex items-center gap-2"
                          onClick={() => handleDeleteChat(chat.id)}
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