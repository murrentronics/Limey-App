import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";

const Message = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [receiver, setReceiver] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (username && user) {
      fetchReceiver();
    }
  }, [username, user]);

  const fetchReceiver = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('Error fetching receiver:', error);
        navigate('/inbox');
      } else {
        setReceiver(data);
      }
    } catch (error) {
      console.error('Error fetching receiver:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !user || !receiver) return;

    setSending(true);
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
      
      const existingChat = nonDeletedChats.length > 0 ? nonDeletedChats[0] : null;
      
      console.log('Found existing chats:', existingChats);
      console.log('Non-deleted chats:', nonDeletedChats);
      console.log('Using existing chat:', existingChat);

      let chatId;
      
      if (existingChat) {
        chatId = existingChat.id;
        console.log('Using existing chat:', existingChat.id);
        // Update chat's last message and timestamp
        await supabase
          .from('chats')
          .update({
            last_message: message.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId);
      } else {
        // Try to create new chat, but handle the case where it might already exist
        console.log('Creating new chat between', user.id, 'and', receiver.user_id);
        
        // First, try to find any existing chat (including deleted ones)
        const { data: allExistingChats } = await supabase
          .from('chats')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiver.user_id}),and(sender_id.eq.${receiver.user_id},receiver_id.eq.${user.id})`);
        
        if (allExistingChats && allExistingChats.length > 0) {
          // There's an existing chat (probably deleted), let's reactivate it
          const existingChat = allExistingChats[0];
          console.log('Found existing deleted chat, reactivating:', existingChat.id);
          
          // Reactivate the chat by clearing the deletion flags
          const updateField = existingChat.sender_id === user.id ? 'deleted_for_sender' : 'deleted_for_receiver';
          const { error: reactivateError } = await supabase
            .from('chats')
            .update({ 
              [updateField]: false,
              last_message: message.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingChat.id);
          
          if (reactivateError) {
            console.error('Error reactivating chat:', reactivateError);
            alert('Failed to reactivate chat: ' + reactivateError.message);
            return;
          }
          
          chatId = existingChat.id;
        } else {
          // Create completely new chat
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
      }

      // Send message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: receiver.user_id,
          content: message.trim()
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inbox')}>
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={receiver?.avatar_url} alt={receiver?.username} />
              <AvatarFallback>{receiver?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
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
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Send a message to @{receiver?.username || 'unknown'}</h3>
            <p className="text-white/60 text-sm">Start a conversation</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/50"
            />
            <Button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send size={16} />
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