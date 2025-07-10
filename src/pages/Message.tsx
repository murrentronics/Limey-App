import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/hooks/use-toast";

const Message = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [receiver, setReceiver] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (username && user) {
      fetchReceiver();
    }
  }, [username, user]);

  const fetchReceiver = async () => {
    try {
      setLoading(true);
      console.log('Fetching receiver profile for username:', username);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('Error fetching receiver:', error);
        toast({
          title: "User not found",
          description: "The user you're trying to message doesn't exist",
          variant: "destructive"
        });
        navigate('/inbox');
      } else {
        console.log('Receiver found:', data);
        setReceiver(data);
        
        // Check if user is trying to message themselves
        if (data.user_id === user?.id) {
          toast({
            title: "Cannot message yourself",
            description: "You cannot send a message to yourself",
            variant: "destructive"
          });
          navigate('/inbox');
        }
      }
    } catch (error) {
      console.error('Error fetching receiver:', error);
      toast({
        title: "Error loading user",
        description: "Please try again",
        variant: "destructive"
      });
      navigate('/inbox');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !user || !receiver) {
      if (!message.trim()) {
        toast({
          title: "Empty message",
          description: "Please enter a message before sending",
          variant: "destructive"
        });
      }
      return;
    }

    setSending(true);
    console.log('Sending message to:', receiver.username);
    
    try {
      // Check if chat already exists
      const { data: existingChats, error: chatCheckError } = await supabase
        .from('chats')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiver.user_id}),and(sender_id.eq.${receiver.user_id},receiver_id.eq.${user.id})`);
      
      if (chatCheckError) {
        console.error('Error checking for existing chat:', chatCheckError);
        alert('Failed to check for existing chat: ' + chatCheckError.message);
        return;
      }
      
      // Filter out deleted chats when looking for existing chats
      const nonDeletedChats = existingChats?.filter(chat => {
        if (chat.sender_id === user.id) {
          return !chat.deleted_for_sender;
        } else {
          return !chat.deleted_for_receiver;
        }
      }) || [];
      
      const filteredExistingChat = nonDeletedChats.length > 0 ? nonDeletedChats[0] : null;
      
      console.log('Found existing chats:', existingChats);
      console.log('Non-deleted chats:', nonDeletedChats);
      console.log('Using existing chat:', filteredExistingChat);

      let chatId;
      let currentExistingChat = filteredExistingChat;
      
      if (currentExistingChat) {
        console.log('Found existing non-deleted chat:', currentExistingChat.id);
        chatId = currentExistingChat.id;
        console.log('Using existing chat:', currentExistingChat.id);
        // Update chat's last message and timestamp
        const { error: updateError } = await supabase
          .from('chats')
          .update({
            last_message: message.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId);

        if (updateError) {
          console.error('Error updating existing chat:', updateError);
          throw updateError;
        }
      } else {
        // No non-deleted chat exists, create a completely new chat
        console.log('Creating new chat between', user.id, 'and', receiver.user_id);
        
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            sender_id: user.id,
            receiver_id: receiver.user_id,
            last_message: message.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (chatError) {
          console.error('Error creating chat:', chatError);
          alert('Failed to create chat: ' + chatError.message);
          return;
        }
        console.log('Created new chat:', newChat);
        chatId = newChat.id;
      }

      // Send the message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: receiver.user_id,
          content: message.trim(),
          created_at: new Date().toISOString()
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        alert('Failed to send message: ' + messageError.message);
      } else {
        console.log('Message sent successfully, navigating to chat:', chatId);
        // Navigate to the chat
        navigate(`/chat/${chatId}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + (error instanceof Error ? error.message : 'An unexpected error occurred'));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!receiver) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold mb-4">User not found</h2>
        <Button onClick={() => navigate('/inbox')} variant="outline">
          Back to Messages
        </Button>
      </div>
    );
  }

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
                <AvatarImage src={receiver?.avatar_url} alt={receiver?.username} />
                <AvatarFallback className="bg-white/10 text-white">
                  {receiver?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
            </div>
            <div>
              <h2 className="font-semibold">@{receiver?.username || 'unknown'}</h2>
              <p className="text-xs text-white/60">Send a message</p>
            </div>
          </div>
          <div className="w-8"></div>
        </div>
      </div>

      {/* Message Input */}
      <div className="flex-1 pt-20 pb-32 px-4 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4">
              <Avatar className="w-full h-full">
                <AvatarImage src={receiver?.avatar_url} alt={receiver?.username} />
                <AvatarFallback className="bg-white/10 text-white text-2xl">
                  {receiver?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <h3 className="text-xl font-semibold mb-2">Send a message to @{receiver?.username || 'unknown'}</h3>
            <p className="text-white/60 text-sm">Start a conversation</p>
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full bg-white/10 border-white/20 text-white placeholder-white/50 pr-12"
                disabled={sending}
                maxLength={1000}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-white/40">
                {message.length}/1000
              </div>
            </div>
            
            <Button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Send size={16} />
                  <span>Send Message</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Message;
