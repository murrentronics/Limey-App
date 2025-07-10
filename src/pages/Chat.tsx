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
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deleteForMe' | 'deleteForEveryone';
    messageId: string;
  } | null>(null);

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
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${paramUserId}),and(sender_id.eq.${paramUserId},receiver_id.eq.${user.id})`);
          
          if (error) {
            console.error('Error checking for existing chat:', error);
            toast({ title: 'Failed to check for existing chat', description: error.message, variant: 'destructive' });
            return;
          }
          
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
      
      console.log('Chat access confirmed:', chatCheck);
      
      // Now fetch messages - include deleted messages to show "Message deleted" indicators
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
      console.log('Attempting to send message with data:', {
        chat_id: chatId,
        sender_id: user.id,
        receiver_id: receiverId,
        content: newMessage.trim()
      });
      
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
        toast({
          title: "Failed to send message",
          description: error.message || "Please try again.",
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
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log('Message copied to clipboard:', content);
      setShowMessageMenu(null);
      toast({ title: 'Message copied', description: 'Message copied to clipboard.' });
    } catch (error) {
      console.error('Error copying message:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Message copied to clipboard (fallback):', content);
        setShowMessageMenu(null);
        toast({ title: 'Message copied', description: 'Message copied to clipboard.' });
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        toast({ title: 'Failed to copy', description: 'Could not copy message to clipboard.', variant: 'destructive' });
      }
      document.body.removeChild(textArea);
    }
  };

  const deleteMessage = async (messageId: string, deleteForEveryone: boolean = false) => {
    setShowMessageMenu(null);
    
    // Show confirmation dialog
    setConfirmAction({
      type: deleteForEveryone ? 'deleteForEveryone' : 'deleteForMe',
      messageId
    });
    setShowConfirmDialog(true);
  };

  const confirmDeleteMessage = async () => {
    if (!user || !confirmAction) return;
    
    try {
      const { messageId, type } = confirmAction;
      const deleteForEveryone = type === 'deleteForEveryone';
      
      if (deleteForEveryone) {
        const { error } = await supabase
          .from('messages')
          .update({ deleted_for_everyone: true })
          .eq('id', messageId);
        
        if (error) {
          console.error('Error deleting message for everyone:', error);
          toast({ title: 'Failed to delete message', description: error.message, variant: 'destructive' });
          return;
        }
        
        console.log('Message deleted for everyone');
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        toast({ 
          title: 'Message deleted for everyone', 
          description: 'The message has been removed for all users.',
          className: 'bg-green-600 text-white border-green-700'
        });
      } else {
        // Delete for me only - mark as deleted for sender
        const { error } = await supabase
          .from('messages')
          .update({ deleted_for_sender: true })
          .eq('id', messageId);
        
        if (error) {
          console.error('Error marking message as deleted for sender:', error);
          toast({ title: 'Failed to delete message', description: error.message, variant: 'destructive' });
          return;
        }
        
        console.log('Message marked as deleted for sender');
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, deleted_for_sender: true } : msg
        ));
        toast({ title: 'Message deleted', description: 'The message has been removed from your view.' });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({ title: 'Failed to delete message', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const deleteChat = async () => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    try {
      // Mark chat as deleted for the current user instead of actually deleting it
      const updateField = chat?.sender_id === user?.id ? 'deleted_for_sender' : 'deleted_for_receiver';
      
      const { error } = await supabase
        .from('chats')
        .update({ [updateField]: true })
        .eq('id', chatId);
      
      if (error) {
        console.error('Error deleting chat:', error);
        toast({
          title: "Failed to delete chat",
          description: error.message || "Please try again.",
          variant: "destructive"
        });
      } else {
        console.log('Chat marked as deleted for current user');
        toast({
          title: "Chat deleted",
          description: "The chat has been removed from your inbox.",
          variant: "default"
        });
        // Navigate back to inbox
        navigate('/inbox');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Failed to delete chat",
        description: "An unexpected error occurred.",
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

  // Debug function to check all messages
  const debugCheckMessages = async () => {
    try {
      console.log('=== DEBUG: Checking all messages in database ===');
      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Debug error:', error);
      } else {
        console.log('Recent messages:', allMessages);
      }
      
      // Also check current chat
      console.log('=== DEBUG: Checking current chat ===');
      const { data: currentChat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();
      
      if (chatError) {
        console.error('Chat debug error:', chatError);
      } else {
        console.log('Current chat:', currentChat);
      }
      
      // Test message insertion
      console.log('=== DEBUG: Testing message insertion ===');
      const testMessage = {
        chat_id: chatId,
        sender_id: user?.id,
        receiver_id: getChatPartner()?.user_id,
        content: 'TEST MESSAGE - ' + new Date().toISOString()
      };
      console.log('Test message data:', testMessage);
      
      const { data: testInsert, error: insertError } = await supabase
        .from('messages')
        .insert(testMessage)
        .select()
        .single();
      
      if (insertError) {
        console.error('Test insert error:', insertError);
        console.error('Error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
            } else {
        console.log('Test insert successful:', testInsert);
        // Clean up test message
        await supabase
          .from('messages')
          .delete()
          .eq('id', testInsert.id);
        console.log('Test message cleaned up');
      }
    } catch (error) {
      console.error('Debug function error:', error);
    }
  };

  // Test function to verify real-time is working
  const testRealtime = async () => {
    if (!user || !chatId) return;
    
    try {
      console.log('Testing real-time functionality...');
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: chat?.sender_id === user.id ? chat?.receiver_id : chat?.sender_id,
          content: `Test message at ${new Date().toLocaleTimeString()}`
        })
        .select()
        .single();

      if (error) {
        console.error('Test message error:', error);
      } else {
        console.log('Test message sent:', data);
      }
    } catch (error) {
      console.error('Test realtime error:', error);
    }
  };

  // Typing indicator functions
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
            {/* Chat Menu Button */}
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
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400 flex items-center gap-2"
                  onClick={() => {
                    setShowChatMenu(false);
                    deleteChat();
                  }}
                >
                  <Trash2 size={14} />
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
              // Hide messages that were deleted for everyone or deleted for the current user
              const isDeletedForEveryone = message.deleted_for_everyone === true;
              const isDeletedForSender = isOwnMessage && message.deleted_for_sender === true;
              const isDeletedForReceiver = !isOwnMessage && message.deleted_for_receiver === true;
              const isDeleted = isDeletedForEveryone || isDeletedForSender || isDeletedForReceiver;

              if (isDeleted) {
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
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
                >
                  <div className="relative flex items-start">
                    {/* 3 Dots Menu for own messages */}
                    {isOwnMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 mr-2 mt-1 text-white/60 hover:text-white"
                        onClick={() => setShowMessageMenu(showMessageMenu === message.id ? null : message.id)}
                      >
                        <MoreVertical size={16} />
                      </Button>
                    )}
                    
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
                    
                    {/* Dropdown Menu */}
                    {showMessageMenu === message.id && isOwnMessage && (
                      <div className="absolute top-0 right-0 mt-8 bg-black/90 rounded-lg shadow-lg z-10 min-w-[140px] max-w-[200px]" data-dropdown>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                          onClick={() => copyMessage(message.content)}
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400"
                          onClick={() => deleteMessage(message.id, false)}
                        >
                          Delete for me
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 text-red-400"
                          onClick={() => deleteMessage(message.id, true)}
                        >
                          Delete for everyone
                        </button>
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="bg-black/90 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Are you sure you want to delete this message?</h3>
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
                onClick={confirmDeleteMessage}
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

export default Chat;
