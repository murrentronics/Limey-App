import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Trash2, User, Copy, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/hooks/use-toast";

const Chat = () => {
  const { chatId, userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressedMessage, setLongPressedMessage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      if (chatId) {
        // Existing chat
        fetchChat();
        fetchMessages();
        const cleanup = subscribeToMessages();
        const typingCleanup = subscribeToTypingStatus();
        return () => {
          cleanup();
          typingCleanup();
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
      } else if (paramUserId) {
        // No chatId, but userId param present: start new chat
        (async () => {
          // Check if chat already exists between user and paramUserId
          const { data: existingChats, error } = await supabase
            .from('chats')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
          let chat = existingChats?.find(
            c => (c.sender_id === user.id && c.receiver_id === paramUserId) ||
                 (c.sender_id === paramUserId && c.receiver_id === user.id)
          );
          if (!chat) {
            // Create new chat
            const { data: newChat, error: createError } = await supabase
              .from('chats')
              .insert({ sender_id: user.id, receiver_id: paramUserId })
              .select()
              .single();
            if (createError) {
              toast({ title: 'Failed to start chat', description: createError.message, variant: 'destructive' });
              return;
            }
            chat = newChat;
          }
          // Redirect to the new/existing chat
          navigate(`/chat/${chat.id}`, { replace: true });
        })();
      }
    }
  }, [chatId, user, paramUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowMessageMenu(null);
        setShowChatMenu(false);
        setLongPressedMessage(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchChat = async () => {
    try {
      console.log('Fetching chat with ID:', chatId);
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          sender:profiles!chats_sender_id_fkey(username, avatar_url),
          receiver:profiles!chats_receiver_id_fkey(username, avatar_url)
        `)
        .eq('id', chatId)
        .single();

      if (error) {
        console.error('Error fetching chat:', error);
        navigate('/inbox');
        return;
      }

      // Check if the current user has deleted this chat
      const isDeletedForUser = 
        (data.sender_id === user?.id && data.deleted_for_sender) ||
        (data.receiver_id === user?.id && data.deleted_for_receiver);

      if (isDeletedForUser) {
        console.log('Chat has been deleted by current user, redirecting to inbox');
        navigate('/inbox');
        return;
      }

      console.log('Chat data:', data);
      setChat(data);
    } catch (error) {
      console.error('Error fetching chat:', error);
      navigate('/inbox');
    }
  };

  const fetchMessages = async () => {
    try {
      console.log('Fetching messages for chatId:', chatId);
      
      // First, let's check if the chat exists and we have access to it
      const { data: chatCheck, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();
      
      if (chatError) {
        console.error('Chat access error:', chatError);
        navigate('/inbox');
        return;
      }
      
      // Check if the current user has deleted this chat
      const isDeletedForUser = 
        (chatCheck.sender_id === user?.id && chatCheck.deleted_for_sender) ||
        (chatCheck.receiver_id === user?.id && chatCheck.deleted_for_receiver);

      if (isDeletedForUser) {
        console.log('Chat has been deleted by current user, redirecting to inbox');
        navigate('/inbox');
        return;
      }
      
      // Now fetch messages
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        console.log('Messages data:', data);
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    console.log('Setting up real-time subscription for chat:', chatId);
    
    const channelName = `messages_${chatId}_${Date.now()}`;
    
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('New message received via real-time:', payload.new);
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(msg => msg.id === payload.new.id);
          if (exists) {
            console.log('Message already exists, skipping duplicate');
            return prev;
          }
          console.log('Adding new message to state');
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('Message updated via real-time:', payload.new);
        setMessages(prev => prev.map(msg => 
          msg.id === payload.new.id ? payload.new : msg
        ));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('Message deleted via real-time:', payload.old);
        setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription for chat:', chatId);
      subscription.unsubscribe();
    };
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const threshold = 100; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsAtBottom(isNearBottom);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chat) {
      if (!chat) {
        toast({
          title: "Chat not loaded",
          description: "Please wait for the chat to load before sending a message.",
          variant: "destructive"
        });
      }
      return;
    }

    console.log('Sending message:', newMessage.trim());
    
    // Determine the correct receiver_id
    const receiverId = chat.sender_id === user.id ? chat.receiver_id : chat.sender_id;
    
    // Prevent sending message to yourself
    if (receiverId === user.id) {
      console.error('Cannot send message to yourself!');
      return;
    }
    
    // Stop typing indicator
    setIsTyping(false);
    broadcastTypingStatus(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage(""); // Clear input immediately for better UX
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: receiverId,
          content: messageContent
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        // Restore message in input if failed
        setNewMessage(messageContent);
        toast({
          title: "Failed to send message",
          description: "Please try again.",
          variant: "destructive"
        });
      } else {
        console.log('Message sent successfully:', data);
        
        // Update chat's last message and timestamp
        await supabase
          .from('chats')
          .update({
            last_message: messageContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId);
        
        // Force scroll to bottom after sending
        setIsAtBottom(true);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message in input if failed
      setNewMessage(messageContent);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLongPress = (messageId: string) => {
    const timer = setTimeout(() => {
      setLongPressedMessage(messageId);
      setShowMessageMenu(null);
    }, 500); // Reduced from 2000ms to 500ms for better UX
    setLongPressTimer(timer);
  };

  const handleTouchStart = (messageId: string) => {
    handleLongPress(messageId);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setLongPressedMessage(null);
      toast({
        title: "Message copied",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      console.error('Error copying message:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setLongPressedMessage(null);
        toast({
          title: "Message copied",
          description: "Message copied to clipboard",
        });
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        toast({
          title: "Copy failed",
          description: "Unable to copy message",
          variant: "destructive"
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const deleteMessage = async (messageId: string, deleteForEveryone: boolean = false) => {
    try {
      if (deleteForEveryone) {
        const { error } = await supabase
          .from('messages')
          .update({ deleted_for_everyone: true })
          .eq('id', messageId);
        
        if (error) {
          console.error('Error deleting message for everyone:', error);
          toast({
            title: "Delete failed",
            description: "Unable to delete message",
            variant: "destructive"
          });
        } else {
          console.log('Message deleted for everyone');
          toast({
            title: "Message deleted",
            description: "Message deleted for everyone",
          });
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Delete failed",
        description: "Unable to delete message",
        variant: "destructive"
      });
    }
    setShowMessageMenu(null);
    setLongPressedMessage(null);
  };

  const deleteChat = async () => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
      
      if (error) {
        console.error('Error deleting chat:', error);
        toast({
          title: "Delete failed",
          description: "Unable to delete chat",
          variant: "destructive"
        });
      } else {
        console.log('Chat deleted successfully');
        navigate('/inbox');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Delete failed",
        description: "Unable to delete chat",
        variant: "destructive"
      });
    }
  };

  const getChatPartner = () => {
    if (!chat || !user) return null;
    if (chat.sender_id === user.id) {
      return chat.receiver && chat.receiver.user_id !== user.id ? chat.receiver : null;
    } else if (chat.receiver_id === user.id) {
      return chat.sender && chat.sender.user_id !== user.id ? chat.sender : null;
    }
    return null;
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

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      broadcastTypingStatus(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTypingStatus(false);
    }, 3000);
  };

  const broadcastTypingStatus = async (typing: boolean) => {
    if (!user || !chatId || !chat) return;
    
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          [`typing_${chat.sender_id === user.id ? 'sender' : 'receiver'}`]: typing,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);
      
      if (error) {
        console.error('Error updating typing status:', error);
      }
    } catch (error) {
      console.error('Error broadcasting typing status:', error);
    }
  };

  const subscribeToTypingStatus = () => {
    const subscription = supabase
      .channel(`typing_${chatId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `id=eq.${chatId}`
      }, (payload) => {
        const newChat = payload.new;
        const isCurrentUserSender = chat?.sender_id === user?.id;
        
        if (isCurrentUserSender) {
          setOtherUserTyping(newChat.typing_receiver === true);
        } else {
          setOtherUserTyping(newChat.typing_sender === true);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // Initial scroll to bottom when component mounts
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading chat...</div>
      </div>
    );
  }

  if (!chatId || !chat) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Chat not found</div>
      </div>
    );
  }

  const partner = getChatPartner();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inbox')}>
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-8 h-8">
                <AvatarImage src={partner?.avatar_url} alt={partner?.username} />
                <AvatarFallback>{partner?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
            </div>
            <div>
              <h2 className="font-semibold">@{partner?.username || 'unknown'}</h2>
            </div>
          </div>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowChatMenu(!showChatMenu)}
            >
              <MoreVertical size={20} />
            </Button>
            
            {showChatMenu && (
              <div className="absolute top-full right-0 mt-2 bg-black/90 rounded-lg shadow-lg z-10 min-w-[120px]" data-dropdown>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400"
                  onClick={() => {
                    setShowChatMenu(false);
                    deleteChat();
                  }}
                >
                  Delete Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-20 pb-32"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-white/70">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              const isDeleted = message.deleted_for_everyone === true;

              if (isDeleted) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <span className="text-xs text-white/40 italic">
                      Message deleted
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  onTouchStart={() => handleTouchStart(message.id)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleLongPress(message.id)}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                >
                  <div className="relative max-w-xs sm:max-w-md">
                    <div
                      className={`p-3 rounded-lg ${
                        isOwnMessage
                          ? 'bg-green-600 text-white'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      <p className="text-sm break-words">{message.content}</p>
                      <div className="flex justify-end mt-1">
                        <p className={`text-xs ${
                          formatTime(message.created_at) === "now" 
                            ? "text-green-400 font-medium" 
                            : "opacity-70"
                        }`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Message Menu */}
                    {isOwnMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => setShowMessageMenu(showMessageMenu === message.id ? null : message.id)}
                      >
                        <MoreVertical size={12} />
                      </Button>
                    )}
                    
                    {/* Dropdown Menu */}
                    {showMessageMenu === message.id && isOwnMessage && (
                      <div className="absolute top-0 right-0 mt-8 bg-black/90 rounded-lg shadow-lg z-10 min-w-[120px]" data-dropdown>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400"
                          onClick={() => deleteMessage(message.id, true)}
                        >
                          Delete for everyone
                        </button>
                      </div>
                    )}

                    {/* Long Press Menu */}
                    {longPressedMessage === message.id && (
                      <div className="absolute top-0 right-0 mt-8 bg-black/90 rounded-lg shadow-lg z-10 min-w-[140px]" data-dropdown>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                          onClick={() => copyMessage(message.content)}
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                        {isOwnMessage && (
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400"
                            onClick={() => deleteMessage(message.id, true)}
                          >
                            Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-black/90 backdrop-blur-md border-t border-white/10">
        {/* Typing Indicator */}
        {otherUserTyping && (
          <div className="mb-2 px-3 py-1">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-white/60 italic">
                {partner?.username || 'Someone'} is typing...
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/50"
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim() || !chat}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Chat;
