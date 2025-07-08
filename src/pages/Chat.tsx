import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Trash2, User, Copy, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import BottomNavigation from "@/components/BottomNavigation";

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressedMessage, setLongPressedMessage] = useState<string | null>(null);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const ajaxPollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    if (chatId && user) {
      console.log('Chat component mounted with chatId:', chatId, 'and user:', user.id);
      fetchChat();
      fetchMessages();
      const cleanup = subscribeToMessages();
      const typingCleanup = subscribeToTypingStatus();
      
      // Start AJAX polling for reliable message updates
      startAjaxPolling();
      
      // Debug: Check all messages in the database
      debugCheckMessages();
      
      // Cleanup function
      return () => {
        console.log('Chat component unmounting, cleaning up subscription and polling');
        cleanup();
        typingCleanup();
        stopAjaxPolling();
        // Clear typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }
  }, [chatId, user]);

  useEffect(() => {
    // Disable automatic scrolling to prevent loops
    // User can scroll manually without interference
  }, [messages]);

  // Debug: Log when messages change
  useEffect(() => {
    console.log('Messages state updated, count:', messages.length);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      setLastMessageTimestamp(lastMessage.created_at);
    }
  }, [messages]);

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
      console.log('Fetching messages for chat ID:', chatId);
      console.log('Current user ID:', user?.id);
      
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
        console.log('Number of messages found:', data?.length || 0);
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
    
    // Create a unique channel name for this chat
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
        // Auto-scroll to bottom when new message arrives (only if at bottom)
        setTimeout(() => smartScrollToBottom(), 100);
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
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time messages for chat:', chatId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error in real-time subscription');
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out');
        }
      });

    return () => {
      console.log('Cleaning up subscription for chat:', chatId);
      subscription.unsubscribe();
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Disable scroll detection to prevent feedback loops
    // User can scroll manually without interference
  };

  const smartScrollToBottom = () => {
    // Completely disable automatic scrolling to prevent loops
    console.log('Smart scroll called but disabled to prevent loops');
    // Only allow manual user scrolling
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chat) return;

    console.log('Sending message:', newMessage.trim());
    console.log('Current user ID:', user.id);
    console.log('Chat sender_id:', chat.sender_id);
    console.log('Chat receiver_id:', chat.receiver_id);
    
    // Determine the correct receiver_id
    const receiverId = chat.sender_id === user.id ? chat.receiver_id : chat.sender_id;
    console.log('Determined receiver_id:', receiverId);
    
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
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: receiverId,
          content: newMessage.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
      } else {
        console.log('Message sent successfully:', data);
        console.log('Current messages count before update:', messages.length);
        setNewMessage("");
        
        // Update chat's last message and timestamp
        await supabase
          .from('chats')
          .update({
            last_message: newMessage.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId);
        
        // Auto-scroll to bottom after sending (user always wants to see their message)
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
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
    }, 2000);
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
      console.log('Message copied to clipboard:', content);
      setLongPressedMessage(null);
      // Show a brief success indicator
      const originalText = document.title;
      document.title = 'Copied!';
      setTimeout(() => {
        document.title = originalText;
      }, 1000);
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
        setLongPressedMessage(null);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  const deleteMessage = async (messageId: string, deleteForEveryone: boolean = false) => {
    try {
      if (deleteForEveryone) {
        // Delete for everyone - mark as deleted for everyone instead of actually deleting
        const { error } = await supabase
          .from('messages')
          .update({ deleted_for_everyone: true })
          .eq('id', messageId);
        
        if (error) {
          console.error('Error deleting message for everyone:', error);
        } else {
          console.log('Message deleted for everyone');
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
        }
      } else {
        // Delete for me only - mark as deleted for sender
        const { error } = await supabase
          .from('messages')
          .update({ deleted_for_sender: true })
          .eq('id', messageId);
        
        if (error) {
          console.error('Error marking message as deleted for sender:', error);
        } else {
          console.log('Message marked as deleted for sender');
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, deleted_for_sender: true } : msg
          ));
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
    setShowMessageMenu(null);
    setLongPressedMessage(null);
  };

  const deleteChat = async () => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    try {
      // Actually delete the chat from the database
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
      
      if (error) {
        console.error('Error deleting chat:', error);
      } else {
        console.log('Chat deleted successfully from database');
        // Reload the current chat page after deletion
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const getChatPartner = () => {
    if (!chat || !user) return null;
    // If current user is sender, partner is receiver; else, partner is sender
    if (chat.sender_id === user.id) {
      // Defensive: if receiver is missing, fallback to sender
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
    } else if (diffInMinutes < 1440) { // less than 24 hours
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
        console.log('All messages in database:', allMessages);
      }
      
      console.log('=== DEBUG: Checking all chats in database ===');
      const { data: allChats, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (chatError) {
        console.error('Debug chat error:', chatError);
      } else {
        console.log('All chats in database:', allChats);
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
      // Broadcast typing status to other user
      broadcastTypingStatus(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTypingStatus(false);
    }, 3000);
  };

  const broadcastTypingStatus = async (typing: boolean) => {
    if (!user || !chatId) return;
    
    try {
      // Update typing status in the chat
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
          // Current user is sender, check if receiver is typing
          setOtherUserTyping(newChat.typing_receiver === true);
        } else {
          // Current user is receiver, check if sender is typing
          setOtherUserTyping(newChat.typing_sender === true);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // AJAX Polling Functions (WordPress-style reliable updates)
  const startAjaxPolling = () => {
    console.log('Starting AJAX polling for reliable message updates');
    ajaxPollingRef.current = setInterval(async () => {
      if (!chatId) return;
      
      try {
        // Get the timestamp of the last message we have
        const lastMessageTimestamp = messages.length > 0 ? messages[messages.length - 1].created_at : null;
        
        // Fetch only new messages since our last message
        let query = supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (lastMessageTimestamp) {
          query = query.gt('created_at', lastMessageTimestamp);
        }

        const { data: newMessages, error } = await query;

        if (error) {
          console.error('AJAX polling error:', error);
          return;
        }

        // Only update if we have new messages
        if (newMessages && newMessages.length > 0) {
          console.log('AJAX polling found new messages:', newMessages.length);
          setMessages(prev => {
            // Check for duplicates by message ID
            const existingIds = new Set(prev.map(msg => msg.id));
            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
            
            if (uniqueNewMessages.length > 0) {
              console.log('Adding unique new messages:', uniqueNewMessages.length);
              return [...prev, ...uniqueNewMessages];
            } else {
              console.log('All messages already exist, no duplicates added');
              return prev;
            }
          });
          // Only scroll if user is at bottom, with longer delay
          setTimeout(() => smartScrollToBottom(), 200);
        }
        
      } catch (error) {
        console.error('AJAX polling error:', error);
      }
    }, 5000); // Check every 5 seconds instead of 2
  };

  const stopAjaxPolling = () => {
    if (ajaxPollingRef.current) {
      console.log('Stopping AJAX polling');
      clearInterval(ajaxPollingRef.current);
      ajaxPollingRef.current = null;
    }
  };

  // Force re-render for time updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000); // every 30s
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom only on initial page load
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // After updating messages (real-time, polling, or manual refresh), always scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  const partner = getChatPartner();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
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
              {/* Online status indicator */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
            </div>
            <div>
              <h2 className="font-semibold">@{partner?.username || 'unknown'}</h2>
            </div>
          </div>
          <div className="relative">
            {/* Manual Refresh Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={async () => {
                // Get the timestamp of the last message we have
                const lastMessageTimestamp = messages.length > 0 ? messages[messages.length - 1].created_at : null;
                
                // Fetch only new messages since our last message
                let query = supabase
                  .from('messages')
                  .select('*')
                  .eq('chat_id', chatId)
                  .order('created_at', { ascending: true });

                if (lastMessageTimestamp) {
                  query = query.gt('created_at', lastMessageTimestamp);
                }

                const { data: newMessages, error } = await query;

                if (error) {
                  console.error('Manual refresh error:', error);
                  return;
                }

                // Only update if we have new messages
                if (newMessages && newMessages.length > 0) {
                  console.log('Manual refresh found new messages:', newMessages.length);
                  setMessages(prev => {
                    // Check for duplicates by message ID
                    const existingIds = new Set(prev.map(msg => msg.id));
                    const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
                    
                    if (uniqueNewMessages.length > 0) {
                      console.log('Adding unique new messages:', uniqueNewMessages.length);
                      return [...prev, ...uniqueNewMessages];
                    } else {
                      console.log('All messages already exist, no duplicates added');
                      return prev;
                    }
                  });
                  setTimeout(() => smartScrollToBottom(), 100);
                } else {
                  console.log('No new messages found');
                }
              }}
              className="text-white/60 hover:text-white mr-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
            
            {/* Chat Menu Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowChatMenu(!showChatMenu)}
              className="ml-2"
            >
              <MoreVertical size={20} />
            </Button>
            
            {/* Chat Menu Dropdown */}
            {showChatMenu && (
              <div className="absolute top-full right-0 mt-2 bg-black/90 rounded-lg shadow-lg z-10 min-w-[120px]" data-dropdown>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                  onClick={() => {
                    setShowChatMenu(false);
                    debugCheckMessages();
                  }}
                >
                  Debug Messages
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                  onClick={() => {
                    setShowChatMenu(false);
                    testRealtime();
                  }}
                >
                  Test Message
                </button>
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
        className="absolute left-0 right-0 overflow-y-auto px-4"
        style={{ top: '72px', bottom: '120px' }}
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-white/70">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              // Only hide messages that were deleted for everyone, not for sender only
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
                  <div className="relative">
                    <div
                      className={`p-3 rounded-lg ${
                        isOwnMessage
                          ? 'bg-green-600 text-white'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex justify-center mt-1">
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

      {/* Message Input - Fixed at bottom above bottom navigation */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-black/20 backdrop-blur-md border-t border-white/10">
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
          />
          <Button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="bg-green-600 hover:bg-green-700"
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