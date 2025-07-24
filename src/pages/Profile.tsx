import ModalVerticalFeed from "@/components/ModalVerticalFeed";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import { MoreVertical, Settings, Send, Wallet, Heart, Bookmark, Eye, ChevronDown } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import WalletModal from "@/components/WalletModal";
import { getTrincreditsBalance } from "@/lib/ttpaypalApi";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import clsx from "clsx";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { username } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deleteVideo';
    videoId: string;
    videoUrl: string;
    thumbnailUrl?: string;
  } | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [modalVideos, setModalVideos] = useState<any[]>([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showUnfollowDropdown, setShowUnfollowDropdown] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/profile" && showWalletModal) {
      setRefreshKey((k) => k + 1);
      setShowWalletModal(false); // Optionally close modal after refresh
    }
    // eslint-disable-next-line
  }, [location.pathname]);

  // Real-time subscription for video updates
  useEffect(() => {
    if (!profile?.user_id) return;

    console.log('Setting up real-time subscription for videos of user:', profile.user_id);

    // Subscribe to video updates for this user
    const channel = supabase
      .channel(`videos-${profile.user_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${profile.user_id}`
        },
        async (payload) => {
          console.log('Video update received:', payload);
          
          if (payload.eventType === 'UPDATE') {
            // For updates, merge the new data with existing video
            setUserVideos(prev => 
              prev.map(video => 
                video.id === payload.new.id ? { ...video, ...payload.new } : video
              )
            );
          } else if (payload.eventType === 'DELETE') {
            // For deletes, remove the video from the list
            setUserVideos(prev => prev.filter(video => video.id !== payload.old.id));
          } else if (payload.eventType === 'INSERT') {
            // For inserts, fetch the complete video data including profiles
            try {
              const { data: newVideoData, error } = await supabase
                .from('videos' as any)
                .select('*')
                .eq('id', payload.new.id)
                .single();
                
              if (error) {
                console.error('Error fetching new video data:', error);
                // Fall back to using the payload data
                setUserVideos(prev => [payload.new, ...prev]);
              } else if (newVideoData) {
                // Add the new video to the beginning of the list
                setUserVideos(prev => [newVideoData, ...prev]);
              }
            } catch (err) {
              console.error('Error handling video insert:', err);
              // Fall back to using the payload data
              setUserVideos(prev => [payload.new, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription for videos');
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id]);

  // Real-time subscription for follows updates
  useEffect(() => {
    if (!profile?.user_id) return;

    console.log('Setting up real-time subscription for follows of user:', profile.user_id);

    // Subscribe to follows table changes that affect this user
    const followsChannel = supabase
      .channel(`follows-${profile.user_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows'
        },
        async (payload) => {
          console.log('Follow update received:', payload);
          
          // Handle different event types explicitly
          if (payload.eventType === 'INSERT') {
            // New follow created
            const newFollowerId = payload.new?.follower_id;
            const newFollowingId = payload.new?.following_id;
            
            // Check if this follow affects the current profile
            const affectsThisProfile = 
              newFollowerId === profile.user_id || 
              newFollowingId === profile.user_id;
            
            if (affectsThisProfile) {
              console.log('New follow affects this profile, updating counts');
              // Refresh follow counts for any profile view
              fetchFollowCounts();
              
              // If this is another user's profile and they just followed the current user
              if (!isOwnProfile && user && newFollowerId === profile.user_id && newFollowingId === user.id) {
                checkFollowStatus();
              }
            }
          } 
          else if (payload.eventType === 'DELETE') {
            // Follow removed
            const oldFollowerId = payload.old?.follower_id;
            const oldFollowingId = payload.old?.following_id;
            
            // Check if this unfollow affects the current profile
            const affectsThisProfile = 
              oldFollowerId === profile.user_id || 
              oldFollowingId === profile.user_id;
            
            if (affectsThisProfile) {
              console.log('Unfollow affects this profile, updating counts');
              // Refresh follow counts for any profile view
              fetchFollowCounts();
              
              // If this is another user's profile and they just unfollowed the current user
              if (!isOwnProfile && user && oldFollowerId === profile.user_id && oldFollowingId === user.id) {
                checkFollowStatus();
              }
            }
          }
          else if (payload.eventType === 'UPDATE') {
            // Follow updated (unlikely but handle it anyway)
            const affectsThisProfile = 
              payload.new?.follower_id === profile.user_id || 
              payload.new?.following_id === profile.user_id;
            
            if (affectsThisProfile) {
              console.log('Follow update affects this profile, updating counts');
              fetchFollowCounts();
              
              // If viewing another user's profile and the update affects the current user
              if (!isOwnProfile && user) {
                const affectsCurrentUser = 
                  (payload.new?.follower_id === profile.user_id && payload.new?.following_id === user.id);
                
                if (affectsCurrentUser) {
                  checkFollowStatus();
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription for follows');
      supabase.removeChannel(followsChannel);
    };
  }, [profile?.user_id, isOwnProfile, user]);

  useEffect(() => {
    fetchProfile();
    if (isOwnProfile) fetchSavedVideos();
  }, [username, user, isOwnProfile]);

  // Fetch follow counts when profile loads
  useEffect(() => {
    if (profile?.user_id) {
      console.log('Profile loaded, fetching initial follow counts');
      fetchFollowCounts();
    }
  }, [profile?.user_id]);
  
  // Refresh follow counts periodically to ensure consistency
  useEffect(() => {
    if (!profile?.user_id) return;
    
    // Refresh counts every 30 seconds as a fallback
    const intervalId = setInterval(() => {
      console.log('Periodic refresh of follow counts');
      fetchFollowCounts();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [profile?.user_id]);

  // Check follow status when viewing another user's profile
  useEffect(() => {
    if (!isOwnProfile && profile?.user_id && user) {
      checkFollowStatus();
    }
  }, [isOwnProfile, profile?.user_id, user]);



  useEffect(() => {
    if (isOwnProfile) {
      getTrincreditsBalance(user?.id || '').then(balance => {
        setWalletBalance(balance);
      }).catch(() => setWalletBalance(0));
    }
  }, [isOwnProfile, user?.id]);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // Handle click outside for unfollow dropdown
  useEffect(() => {
    if (!showUnfollowDropdown) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowUnfollowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUnfollowDropdown]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      let targetUserId = user?.id;

      let isOwn = false;

      if (username) {
        // Fetch profile by username
        const { data: profileByUsername, error: usernameError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (usernameError) {
          console.error('Error fetching profile by username:', usernameError);
          // Try to find by user_id if username doesn't exist
          const { data: profileById, error: idError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', username)
            .single();

          if (idError) {
            console.error('Profile not found:', idError);
            setProfile(null);
            setLoading(false);
            return;
          } else {
            setProfile(profileById);
            targetUserId = profileById.user_id;
            // Check if this is the current user's profile
            isOwn = profileById.user_id === user?.id;
          }
        } else {
          setProfile(profileByUsername);
          targetUserId = profileByUsername.user_id;
          // Check if this is the current user's profile
          isOwn = profileByUsername.user_id === user?.id;
        }
      } else {
        // No username provided, fetch current user's profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data);
          isOwn = true;
        }
      }

      setIsOwnProfile(isOwn);

      // Fetch videos for the target user
      if (targetUserId) {
        await fetchUserVideos(targetUserId);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user videos from the new videos table only (all assets in limeytt-uploads)
  const fetchUserVideos = async (targetUserId: string) => {
    try {
      // Use a simpler query without the profiles relationship to avoid type issues
      const { data: dbVideos, error: dbError } = await supabase
        .from('videos' as any)
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      
      if (dbError) {
        console.error('Error fetching user videos:', dbError);
        setUserVideos([]);
        return;
      }
      
      console.log('User videos fetched:', dbVideos?.length || 0, 'videos');
      setUserVideos(dbVideos || []);
    } catch (err) {
      console.error('Error fetching user videos:', err);
      setUserVideos([]);
    }
  };

  const fetchSavedVideos = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('saved_videos')
        .select('video:videos(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        setSavedVideos([]);
        return;
      }
      setSavedVideos((data || []).map((row: any) => row.video));
    } catch (err) {
      setSavedVideos([]);
    }
  }

  const confirmDeleteVideo = async () => {
    if (!confirmAction) return;

    try {
      const { videoId, videoUrl, thumbnailUrl } = confirmAction;

      // Delete from videos table
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (deleteError) {
        toast({
          title: 'Error deleting video',
          description: deleteError.message,
          variant: 'destructive',
        });
        setShowConfirmDialog(false);
        setConfirmAction(null);
        return;
      }

      // Delete from storage
      if (thumbnailUrl) {
        const { error: storageError } = await supabase.storage.from('limeytt-uploads').remove([thumbnailUrl]);
        if (storageError) {
          console.error('Error deleting thumbnail from storage:', storageError);
          // Optionally, you might want to log this error to a service
        }
      }
      if (videoUrl) {
        const { error: storageError } = await supabase.storage.from('limeytt-uploads').remove([videoUrl]);
        if (storageError) {
          console.error('Error deleting video file from storage:', storageError);
          // Optionally, you might want to log this error to a service
        }
      }

      toast({
        title: 'Video deleted',
        description: 'Your video has been deleted.',
      });
      setShowConfirmDialog(false);
      setConfirmAction(null);
      setUserVideos(prev => prev.filter(video => video.id !== videoId));
      setModalVideos(prev => prev.filter(video => video.id !== videoId));
      setSavedVideos(prev => prev.filter(video => video.id !== videoId));
    } catch (err) {
      console.error('Error confirming video deletion:', err);
      toast({
        title: 'Error deleting video',
        description: 'Failed to delete video.',
        variant: 'destructive',
      });
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  // Fetch followers and following lists
  const fetchFollowers = async () => {
    if (!profile?.user_id) return;
    setLoadingFollowers(true);
    try {
      const { data, error } = await supabase
        .from('follows' as any)
        .select('follower_id')
        .eq('following_id', profile.user_id);
      
      if (error || !data) {
        setFollowers([]);
        return;
      }

      // Fetch profiles separately to avoid relationship issues
      const followerIds = data.map((row: any) => row.follower_id);
      if (followerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles' as any)
          .select('user_id, username, avatar_url, display_name')
          .in('user_id', followerIds);
        
        setFollowers(profilesData || []);
      } else {
        setFollowers([]);
      }
    } finally {
      setLoadingFollowers(false);
    }
  };
  const fetchFollowing = async () => {
    if (!profile?.user_id) return;
    setLoadingFollowing(true);
    try {
      const { data, error } = await supabase
        .from('follows' as any)
        .select('following_id')
        .eq('follower_id', profile.user_id);
      
      if (error || !data) {
        setFollowing([]);
        return;
      }

      // Fetch profiles separately to avoid relationship issues
      const followingIds = data.map((row: any) => row.following_id);
      if (followingIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles' as any)
          .select('user_id, username, avatar_url, display_name')
          .in('user_id', followingIds);
        
        setFollowing(profilesData || []);
      } else {
        setFollowing([]);
      }
    } finally {
      setLoadingFollowing(false);
    }
  };
  // Remove user from following
  const handleRemoveFollowing = async (targetUserId: string) => {
    setRemovingId(targetUserId);
    const { error } = await supabase.from('follows' as any).delete().eq('follower_id', profile.user_id).eq('following_id', targetUserId);
    
    if (!error) {
      // Update UI immediately for better user experience
      setFollowing(following.filter((u) => u.user_id !== targetUserId));
      // The real-time subscription will handle updating the counts for all users
      // But we also update locally for immediate feedback
      setFollowingCount(prev => Math.max(0, prev - 1));
      // Fetch the latest counts to ensure accuracy
      fetchFollowCounts();
    }
    
    setRemovingId(null);
  };
  
  // Remove user from followers
  const handleRemoveFollower = async (targetUserId: string) => {
    setRemovingId(targetUserId);
    const { error } = await supabase.from('follows' as any).delete().eq('follower_id', targetUserId).eq('following_id', profile.user_id);
    
    if (!error) {
      // Update UI immediately for better user experience
      setFollowers(followers.filter((u) => u.user_id !== targetUserId));
      // The real-time subscription will handle updating the counts for all users
      // But we also update locally for immediate feedback
      setFollowersCount(prev => Math.max(0, prev - 1));
      // Fetch the latest counts to ensure accuracy
      fetchFollowCounts();
    }
    
    setRemovingId(null);
  };

  // Helper to get total likes received (only sum from userVideos)
  const getTotalLikes = () => {
    if (!Array.isArray(userVideos)) return 0;
    return userVideos.reduce((sum, v) => sum + (v.like_count || 0), 0);
  };

  // Fetch actual follow counts
  const fetchFollowCounts = async () => {
    if (!profile?.user_id) return;
    
    console.log('Fetching follow counts for user:', profile.user_id);
    
    try {
      // Use a more efficient query with count() instead of fetching all records
      // Get following count (users this profile is following)
      const { data: followingData, error: followingError, count: followingCount } = await supabase
        .from('follows' as any)
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', profile.user_id);
      
      if (followingError) {
        console.error('Error fetching following count:', followingError);
      } else {
        console.log('Following count:', followingCount);
        setFollowingCount(followingCount || 0);
      }

      // Get followers count (users following this profile)
      const { data: followersData, error: followersError, count: followersCount } = await supabase
        .from('follows' as any)
        .select('id', { count: 'exact', head: true })
        .eq('following_id', profile.user_id);
      
      if (followersError) {
        console.error('Error fetching followers count:', followersError);
      } else {
        console.log('Followers count:', followersCount);
        setFollowersCount(followersCount || 0);
      }
      
      // Log the updated counts for debugging
      console.log('Updated follow counts - Following:', followingCount, 'Followers:', followersCount);
      
    } catch (error) {
      console.error('Error fetching follow counts:', error);
      toast({
        title: 'Error',
        description: 'Failed to update follow counts. Please refresh the page.',
        variant: 'destructive',
      });
    }
  };

  // Check if current user is following this profile
  const checkFollowStatus = async () => {
    if (!user || !profile?.user_id) return;
    
    console.log('Checking follow status for current user:', user.id, 'to profile:', profile.user_id);
    
    try {
      const { data, error } = await supabase
        .from('follows' as any)
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profile.user_id)
        .single();
      
      const isCurrentlyFollowing = !error && data;
      console.log('Follow status result:', isCurrentlyFollowing ? 'Following' : 'Not following');
      
      setIsFollowing(isCurrentlyFollowing);
    } catch (err) {
      console.error('Error checking follow status:', err);
      setIsFollowing(false);
    }
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!user || !profile?.user_id || followLoading) return;
    
    setFollowLoading(true);
    
    // Store previous state for potential rollback
    const wasFollowing = isFollowing;
    const prevFollowersCount = followersCount;
    const prevFollowingCount = followingCount;
    
    try {
      if (isFollowing) {
        // Optimistic UI update for unfollow
        setIsFollowing(false);
        setShowUnfollowDropdown(false);
        
        // Update local counts immediately for better UX
        if (isOwnProfile) {
          setFollowingCount(prev => Math.max(0, prev - 1));
        } else {
          // When viewing someone else's profile and unfollowing them
          setFollowersCount(prev => Math.max(0, prev - 1));
        }
        
        // Perform the actual unfollow operation
        const { error } = await supabase
          .from('follows' as any)
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.user_id);
          
        if (error) {
          // Revert optimistic updates on error
          setIsFollowing(wasFollowing);
          if (isOwnProfile) {
            setFollowingCount(prevFollowingCount);
          } else {
            setFollowersCount(prevFollowersCount);
          }
          
          toast({
            title: 'Error',
            description: 'Failed to unfollow user. Please try again.',
            variant: 'destructive',
          });
        } else {
          // Fetch the latest counts to ensure accuracy
          fetchFollowCounts();
        }
      } else {
        // Optimistic UI update for follow
        setIsFollowing(true);
        
        // Update local counts immediately for better UX
        if (isOwnProfile) {
          setFollowingCount(prev => prev + 1);
        } else {
          // When viewing someone else's profile and following them
          setFollowersCount(prev => prev + 1);
        }
        
        // Perform the actual follow operation
        const { error } = await supabase
          .from('follows' as any)
          .insert({
            follower_id: user.id,
            following_id: profile.user_id
          });
          
        if (error) {
          // Revert optimistic updates on error
          setIsFollowing(wasFollowing);
          if (isOwnProfile) {
            setFollowingCount(prevFollowingCount);
          } else {
            setFollowersCount(prevFollowersCount);
          }
          
          toast({
            title: 'Error',
            description: 'Failed to follow user. Please try again.',
            variant: 'destructive',
          });
        } else {
          // Fetch the latest counts to ensure accuracy
          fetchFollowCounts();
        }
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      
      // Revert optimistic updates on error
      setIsFollowing(wasFollowing);
      if (isOwnProfile) {
        setFollowingCount(prevFollowingCount);
      } else {
        setFollowersCount(prevFollowersCount);
      }
      
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !profile?.user_id || sendingMessage) return;
    
    setSendingMessage(true);
    try {
      console.log('Sending message to user:', profile.username);
      
      // Check if chat already exists between user and profile.user_id
      const { data: existingChats, error } = await supabase
        .from('chats' as any)
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.user_id}),and(sender_id.eq.${profile.user_id},receiver_id.eq.${user.id})`);
      
      if (error) {
        console.error('Error checking for existing chat:', error);
        toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
        return;
      }
      
      console.log('Found existing chats:', existingChats);
      
      // Filter out deleted chats when looking for existing chats
      const nonDeletedChats = existingChats?.filter(chat => {
        if (chat.sender_id === user.id) {
          return !chat.deleted_for_sender;
        } else {
          return !chat.deleted_for_receiver;
        }
      }) || [];
      
      const filteredExistingChat = nonDeletedChats.length > 0 ? nonDeletedChats[0] : null;
      console.log('Using existing chat:', filteredExistingChat);
      
      let chatId;
      
      if (filteredExistingChat) {
        console.log('Found existing non-deleted chat:', filteredExistingChat.id);
        chatId = filteredExistingChat.id;
        
        // Update chat's last message and timestamp
        const { error: updateError } = await supabase
          .from('chats' as any)
          .update({
            last_message: messageText.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId);

        if (updateError) {
          console.error('Error updating existing chat:', updateError);
          throw updateError;
        }
      } else {
        // No non-deleted chat exists, create a completely new chat
        console.log('Creating new chat between', user.id, 'and', profile.user_id);
        
        const { data: newChat, error: createError } = await supabase
          .from('chats' as any)
          .insert({
            sender_id: user.id,
            receiver_id: profile.user_id,
            last_message: messageText.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating chat:', createError);
          toast({ title: 'Failed to create chat', description: createError.message, variant: 'destructive' });
          return;
        }
        console.log('Created new chat:', newChat);
        chatId = newChat.id;
      }
      
      // Send the message
      const { error: messageError } = await supabase
        .from('messages' as any)
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: profile.user_id,
          content: messageText.trim(),
          created_at: new Date().toISOString()
        });
      
      if (messageError) {
        console.error('Error sending message:', messageError);
        toast({ title: 'Failed to send message', description: messageError.message, variant: 'destructive' });
        return;
      }
      
      console.log('Message sent successfully, navigating to chat:', chatId);
      
      // Close sheet and navigate to chat
      setShowMessageModal(false);
      setMessageText("");
      navigate(`/chat/${chatId}`);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Failed to send message', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              ← Back
            </Button>
            <h1 className="text-2xl font-black text-primary tracking-wider logo-text-glow" style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: '900',
              letterSpacing: '0.15em',
              filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
            }}>
              Profile Not Found
            </h1>
            <div></div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">User not found</h2>
            <p className="text-muted-foreground">The profile you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  if (profile?.deactivated && !isOwnProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">This user is deactivated</h2>
          <p className="text-muted-foreground">Their profile and videos are hidden.</p>
        </div>
      </div>
    );
  }
  if (profile?.deactivated && isOwnProfile) {
    navigate('/deactivated', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-white tracking-wider logo-text-glow"
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontWeight: '900', letterSpacing: '0.15em', filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))' }}>
            {isOwnProfile ? 'Profile' : 'Viewing...'}
          </span>
          <div className="flex items-center space-x-2">
            {isOwnProfile ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowWalletModal(true)}><Wallet size={16} /></Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}><Settings size={16} /></Button>
                <Button variant="outline" size="sm" onClick={signOut}>Logout</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm"><MoreVertical size={16} /></Button>
            )}
          </div>
        </div>
      </div>
      {/* Profile Header */}
      <div className="p-6">
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative mb-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{profile?.display_name || profile?.username || 'User'}</h2>
          <p className="text-muted-foreground mb-4">@{profile?.username || 'user'}</p>
          {isOwnProfile && (
            <>
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-sm text-muted-foreground">TriniCredits:</span>
                <Badge variant="secondary" className="bg-green-900 text-green-400">
                  TT${walletBalance !== null ? walletBalance.toFixed(2) : '0.00'}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/edit-profile')} 
                className="mb-4"
              >
                Edit Profile
              </Button>
            </>
          )}
          {isOwnProfile && (
            <div className="flex items-center justify-center gap-8 mb-4">
              <button
                className="flex flex-col items-center group"
                onClick={() => { fetchFollowing(); setShowFollowingModal(true); }}
              >
                <span className="text-lg font-bold text-white group-hover:text-primary transition">{followingCount}</span>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition">Following</span>
              </button>
              <button
                className="flex flex-col items-center group"
                onClick={() => { fetchFollowers(); setShowFollowersModal(true); }}
              >
                <span className="text-lg font-bold text-white group-hover:text-primary transition">{followersCount}</span>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition">Followers</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-white">{getTotalLikes()}</span>
                <span className="text-xs text-muted-foreground">Likes</span>
              </div>
            </div>
          )}
          {/* Stats, Bio, Badges, etc. can go here */}
          
          {/* Display follower/following/likes counts for other users (non-clickable) */}
          {!isOwnProfile && (
            <div className="flex items-center justify-center gap-8 mb-4 mt-2">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-white">{followingCount}</span>
                <span className="text-xs text-muted-foreground">Following</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-white">{followersCount}</span>
                <span className="text-xs text-muted-foreground">Followers</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-white">{getTotalLikes()}</span>
                <span className="text-xs text-muted-foreground">Likes</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Follow/Message buttons for other users */}
      {!isOwnProfile && (
        <div className="px-6 mb-4">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <Button
                variant={isFollowing ? "secondary" : "default"}
                size="sm"
                onClick={() => {
                  if (isFollowing) {
                    setShowUnfollowDropdown(!showUnfollowDropdown);
                  } else {
                    handleFollow();
                  }
                }}
                disabled={followLoading}
                className="min-w-[100px] flex items-center justify-center"
              >
                {followLoading ? "..." : isFollowing ? (
                  <span className="flex items-center gap-1">
                    Following <ChevronDown size={14} />
                  </span>
                ) : "Follow"}
              </Button>
              
              {/* Unfollow dropdown */}
              {showUnfollowDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-red-600 rounded-md shadow-lg z-10">
                  <button
                    onClick={handleFollow}
                    className="w-full px-4 py-2 text-white text-sm hover:bg-red-700 rounded-md"
                  >
                    Unfollow
                  </button>
                </div>
              )}
            </div>
            
            {/* Message button - only show if following */}
            {isFollowing && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowMessageModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]"
              >
                <Send size={16} className="mr-2" />
                Message
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs and Videos */}
      <div className="px-4">
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className={`grid w-full ${isOwnProfile ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <TabsTrigger value="videos" className={!isOwnProfile ? 'justify-center' : ''}>Videos</TabsTrigger>
            {isOwnProfile && (
              <>
                <TabsTrigger value="likes">Liked</TabsTrigger>
                <TabsTrigger value="saved"><Bookmark className="inline mr-1" size={16}/>Saved</TabsTrigger>
              </>
            )}
          </TabsList>
          <TabsContent value="videos" className="mt-4">
            {Array.isArray(userVideos) && userVideos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {userVideos.map((video, idx) => (
                  <Card key={video.id} className="relative aspect-[9/16] cursor-pointer group bg-black/10 overflow-hidden"
                    onClick={() => { setCurrentVideoIndex(idx); setModalVideos(userVideos); setShowVideoModal(true); }}>
                    {/* Views icon and count top left */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/70 rounded-full px-2 py-1">
                      <Eye size={16} className="text-white" />
                      <span className="text-xs text-white font-semibold">{video.view_count || 0}</span>
                    </div>
                    {/* 3-dots menu - Only show for own videos, top right */}
                    {isOwnProfile && (
                      <div className="absolute" style={{ top: '-6px', right: '-6px', zIndex: 10, display: 'flex', alignItems: 'center' }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1"
                          onClick={e => {
                            e.stopPropagation();
                            setConfirmAction({ type: 'deleteVideo', videoId: video.id, videoUrl: video.video_url, thumbnailUrl: video.thumbnail_url });
                            setShowConfirmDialog(true);
                          }}
                        >
                          <MoreVertical size={20} style={{ transform: 'rotate(180deg)' }} />
                        </Button>
                      </div>
                    )}
                    {video.thumbnail_url ? (
                      <img 
                        src={
                          video.thumbnail_url.startsWith('http')
                            ? video.thumbnail_url
                            : supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl
                        } 
                        alt={video.title} 
                        className="w-full h-full object-cover rounded" 
                        onError={(e) => {
                          console.error('Error loading thumbnail:', e);
                          (e.target as HTMLImageElement).src = '/placeholder-thumbnail.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">No Cover</div>
                    )}
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                        {(() => { const d = Number(video.duration); if (!d || isNaN(d) || d < 0) return '0:00'; const mins = Math.floor(d / 60); const secs = Math.floor(d % 60); return `${mins}:${secs.toString().padStart(2, '0')}`; })()}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📹</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">No videos yet</h3>
                <p className="text-muted-foreground mb-4">
                  {isOwnProfile 
                    ? "You haven't uploaded any videos yet." 
                    : `${profile?.username || 'This user'} hasn't uploaded any videos yet.`}
                </p>
                {isOwnProfile && (
                  <Button variant="default" onClick={() => navigate('/upload')}>
                    Upload Your First Video
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          {/* Likes tab for own profile only */}
          {isOwnProfile && (
            <TabsContent value="likes" className="mt-4">
              <div className="text-center py-12">
                <p className="text-muted-foreground">Your liked videos will appear here</p>
              </div>
            </TabsContent>
          )}
          {isOwnProfile && (
            <TabsContent value="saved" className="mt-4">
              <div className="grid grid-cols-3 gap-2">
                {savedVideos.map((video, idx) => (
                  <Card key={video.id} className="relative aspect-[9/16] cursor-pointer group bg-black/10 overflow-hidden"
                    onClick={() => { setCurrentVideoIndex(idx); setModalVideos(savedVideos); setShowVideoModal(true); }}>
                    {/* Views icon and count top left */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/70 rounded-full px-2 py-1">
                      <Eye size={16} className="text-white" />
                      <span className="text-xs text-white font-semibold">{video.view_count || 0}</span>
                    </div>
                    {video.thumbnail_url ? (
                      <img 
                        src={
                          video.thumbnail_url.startsWith('http')
                            ? video.thumbnail_url
                            : supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl
                        } 
                        alt={video.title} 
                        className="w-full h-full object-cover rounded" 
                        onError={(e) => {
                          console.error('Error loading thumbnail:', e);
                          (e.target as HTMLImageElement).src = '/placeholder-thumbnail.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">No Cover</div>
                    )}
                    {/* Duration badge bottom right */}
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                        {(() => { const d = Number(video.duration); if (!d || isNaN(d) || d < 0) return '0:00'; const mins = Math.floor(d / 60); const secs = Math.floor(d % 60); return `${mins}:${secs.toString().padStart(2, '0')}`; })()}
                      </Badge>
                    </div>
                  </Card>
                ))}
                {savedVideos.length === 0 && (
                  <div className="text-center py-12 col-span-3">
                    <p className="text-muted-foreground mb-4">No saved videos yet</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      {showVideoModal && currentVideoIndex !== null && (
        <ModalVerticalFeed
          videos={modalVideos.length > 0 ? modalVideos : userVideos}
          startIndex={currentVideoIndex}
          onClose={() => setShowVideoModal(false)}
        />
      )}
      <BottomNavigation />
      <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} refreshKey={refreshKey} />
      {showConfirmDialog && confirmAction && confirmAction.type === 'deleteVideo' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex justify-end p-4">
            <button 
              className="text-white text-lg font-bold" 
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmAction(null);
              }}
            >
              Close
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <h3 className="text-2xl font-bold mb-6 text-primary logo-text-glow text-center">
              Delete Video
            </h3>
            <p className="text-white/70 text-lg mb-8 text-center max-w-md">
              Are you sure you want to delete this video? This action cannot be undone.
            </p>
            <div className="flex space-x-4 w-full max-w-sm">
              <Button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                }}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10 h-12 text-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteVideo}
                variant="destructive"
                className="flex-1 h-12 text-lg"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-2xl font-bold text-primary logo-text-glow">Followers</h3>
            <button className="text-white text-lg font-bold" onClick={() => setShowFollowersModal(false)}>Close</button>
          </div>
          <div className="flex-1 px-4 pt-4 pb-8 overflow-y-auto">
            <div className="w-full max-w-md mx-auto space-y-4">
              {loadingFollowers ? (
                <div className="text-white text-center">Loading...</div>
              ) : followers.length === 0 ? (
                <div className="text-white text-center">No followers yet</div>
              ) : followers.map((f) => (
                <div key={f.user_id} className="flex items-center justify-between bg-black/80 rounded-lg p-3">
                  <div 
                    className="flex items-center gap-3 cursor-pointer" 
                    onClick={() => {
                      setShowFollowersModal(false);
                      navigate(`/profile/${f.username}`);
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={f.avatar_url || undefined} alt={f.username} />
                      <AvatarFallback>{f.username?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">{f.display_name || f.username}</span>
                      <span className="text-gray-400 text-sm">@{f.username}</span>
                    </div>
                  </div>
                  <button
                    className={clsx("text-red-500 font-bold ml-4", removingId === f.user_id && "opacity-50 pointer-events-none")}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent navigation when clicking the remove button
                      handleRemoveFollower(f.user_id);
                    }}
                    disabled={removingId === f.user_id}
                  >Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-2xl font-bold text-primary logo-text-glow">Following</h3>
            <button className="text-white text-lg font-bold" onClick={() => setShowFollowingModal(false)}>Close</button>
          </div>
          <div className="flex-1 px-4 pt-4 pb-8 overflow-y-auto">
            <div className="w-full max-w-md mx-auto space-y-4">
              {loadingFollowing ? (
                <div className="text-white text-center">Loading...</div>
              ) : following.length === 0 ? (
                <div className="text-white text-center">Not following anyone yet</div>
              ) : following.map((f) => (
                <div key={f.user_id} className="flex items-center justify-between bg-black/80 rounded-lg p-3">
                  <div 
                    className="flex items-center gap-3 cursor-pointer" 
                    onClick={() => {
                      setShowFollowingModal(false);
                      navigate(`/profile/${f.username}`);
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={f.avatar_url || undefined} alt={f.username} />
                      <AvatarFallback>{f.username?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">{f.display_name || f.username}</span>
                      <span className="text-gray-400 text-sm">@{f.username}</span>
                    </div>
                  </div>
                  <button
                    className={clsx("text-red-500 font-bold ml-4", removingId === f.user_id && "opacity-50 pointer-events-none")}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent navigation when clicking the remove button
                      handleRemoveFollowing(f.user_id);
                    }}
                    disabled={removingId === f.user_id}
                  >Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Message Sheet - Slides up from bottom */}
      <Sheet open={showMessageModal} onOpenChange={setShowMessageModal}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[80vh] overflow-y-auto" aria-describedby="message-sheet-description">
          {/* Drag handle for swipe down to close */}
          <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4"></div>
          <SheetHeader className="mb-4">
            <SheetTitle>Send Message</SheetTitle>
            <p id="message-sheet-description" className="text-sm text-muted-foreground">
              Send a direct message to this user.
            </p>
          </SheetHeader>
          
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username} />
              <AvatarFallback>{profile?.username?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">@{profile?.username}</p>
              <p className="text-sm text-muted-foreground">Send a message</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="w-full p-3 border rounded-lg resize-none h-24 bg-background"
              maxLength={500}
              autoFocus
            />
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageText("");
                }}
                disabled={sendingMessage}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sendingMessage}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Send size={16} className="mr-2" />
                {sendingMessage ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default Profile;
