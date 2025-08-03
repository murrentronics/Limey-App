import ModalVerticalFeed from "@/components/ModalVerticalFeed";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import { MoreVertical, Settings, Send, Wallet, Heart, Bookmark, Eye, ChevronDown, X, TrendingUp, Trash2, Plus, Check, UserMinus, Bell, Shield } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import WalletModal from "@/components/WalletModal";
import { getTrincreditsBalance } from "@/lib/trinepayApi";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import clsx from "clsx";
import { getUserSponsoredAds, deleteSponsoredAd } from "@/lib/adminUtils";

const Profile = () => {
  const { user, signOut, isAdmin, loading: authLoading } = useAuth();
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
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);
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
  const [followerFollowStatus, setFollowerFollowStatus] = useState<{ [userId: string]: boolean }>({});
  const [pushNotification, setPushNotification] = useState({
    type: 'all', // 'all' or 'individual'
    targetUsername: '',
    title: '',
    message: ''
  });
  const [sendingPush, setSendingPush] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [loadingSentNotifications, setLoadingSentNotifications] = useState(false);
  const [viewCounts, setViewCounts] = useState<{ [key: string]: number }>({});
  const [sponsoredAds, setSponsoredAds] = useState<any[]>([]);
  const [showAdMenu, setShowAdMenu] = useState<string | null>(null);
  const [deletingAdId, setDeletingAdId] = useState<string | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [manualAdminCheck, setManualAdminCheck] = useState<boolean | null>(null);

  const location = useLocation();



  useEffect(() => {
    if (location.pathname === "/profile" && showWalletModal) {
      setRefreshKey((k) => k + 1);
      setShowWalletModal(false); // Optionally close modal after refresh
    }
    // eslint-disable-next-line
  }, [location.pathname]);

  // Real-time subscription for video updates - OPTIMIZED
  useEffect(() => {
    if (!profile?.user_id || userVideos.length === 0) return;

    // Only subscribe if we have videos to track
    const videoIds = userVideos.map(v => v.id);
    if (videoIds.length === 0) return;

    // Create a single subscription for all user's videos
    const videosChannel = supabase
      .channel(`user_videos_${profile.user_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos',
        filter: `user_id=eq.${profile.user_id}`
      }, (payload) => {
        // Update the specific video in our state
        setUserVideos(prev => prev.map(video =>
          video.id === payload.new.id
            ? { ...video, ...payload.new }
            : video
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(videosChannel);
    };
  }, [profile?.user_id, userVideos.length]);

  // Real-time subscription for view counts - OPTIMIZED
  useEffect(() => {
    if (!profile?.user_id || userVideos.length === 0) return;

    // Subscribe to view changes for user's videos only
    const viewsChannel = supabase
      .channel(`user_views_${profile.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_views',
        filter: `video_id=in.(${userVideos.map(v => v.id).join(',')})`
      }, (payload) => {
        // Update view count for the specific video
        if (payload.new?.video_id) {
          setUserVideos(prev => prev.map(video =>
            video.id === payload.new.video_id
              ? { ...video, view_count: (video.view_count || 0) + 1 }
              : video
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(viewsChannel);
    };
  }, [profile?.user_id, userVideos.length]);

  // Real-time subscription for follows updates - OPTIMIZED
  useEffect(() => {
    if (!profile?.user_id) return;

    // Only subscribe to follow changes for this specific user
    const followsChannel = supabase
      .channel(`user_follows_${profile.user_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'follows',
        filter: `following_id=eq.${profile.user_id}`
      }, () => {
        // Refresh follow counts when follows change
        fetchFollowCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(followsChannel);
    };
  }, [profile?.user_id]);

  useEffect(() => {
    fetchProfile();
    if (isOwnProfile) {
      if (!isAdmin) {
        fetchSavedVideos();
      }
      if (user?.id) fetchUserSponsoredAds(user.id);
    }
  }, [username, user, isOwnProfile, isAdmin]);

  // Fetch follow counts when profile loads
  useEffect(() => {
    if (profile?.user_id) {
      fetchFollowCounts();
    }
  }, [profile?.user_id]);

  // Refresh follow counts periodically to ensure consistency
  useEffect(() => {
    if (!profile?.user_id) return;

    // Refresh counts every 30 seconds as a fallback
    const intervalId = setInterval(() => {
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
    if (isOwnProfile && user?.id) {
      getTrincreditsBalance(user.id).then(async (balance) => {
        setWalletBalance(balance);
        
        // AUTO-SYNC: Sync balance to WordPress when profile loads
        try {
          const { fixWordPressBalance } = await import('@/lib/trinepayApi');
          await fixWordPressBalance(user.id);
          console.log('Auto-synced balance to WordPress from profile:', balance);
        } catch (syncError) {
          console.warn('Auto-sync from profile failed:', syncError);
          // Don't fail profile loading if sync fails
        }
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

  // Format view count for display
  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  // Fetch genuine view counts for videos
  const fetchViewCounts = async (videos: any[]) => {
    try {
      const newViewCounts: { [key: string]: number } = {};

      // Get genuine view counts from the database function
      for (const video of videos) {
        try {
          const { data: genuineCount, error } = await supabase.rpc('get_genuine_view_count', {
            video_uuid: video.id
          });

          if (!error && typeof genuineCount === 'number') {
            newViewCounts[video.id] = genuineCount;
          } else {
            // Fallback to the view_count from the video record
            newViewCounts[video.id] = video.view_count || 0;
          }
        } catch (err) {
          console.error(`Error getting view count for video ${video.id}:`, err);
          newViewCounts[video.id] = video.view_count || 0;
        }
      }

      setViewCounts(prev => ({ ...prev, ...newViewCounts }));

    } catch (error) {
      console.error('Error checking view counts:', error);
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


      setUserVideos(dbVideos || []);

      // Fetch view counts for the videos
      if (dbVideos && dbVideos.length > 0) {
        await fetchViewCounts(dbVideos);
      }
    } catch (err) {
      console.error('Error fetching user videos:', err);
      setUserVideos([]);
    }
  };

  const fetchUserSponsoredAds = async (targetUserId: string) => {
    if (!isOwnProfile) return; // Only fetch for own profile
    try {
      const ads = await getUserSponsoredAds(targetUserId);
      setSponsoredAds(ads || []);
    } catch (error) {
      console.error('Error fetching sponsored ads:', error);
      setSponsoredAds([]);
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!user || deletingAdId) return;

    setDeletingAdId(adId);
    setShowAdMenu(null);

    try {
      const result = await deleteSponsoredAd(adId, user.id);

      if (result.success) {
        // Remove the ad from the local state
        setSponsoredAds(prev => prev.filter(ad => ad.id !== adId));

        toast({
          title: "Ad Deleted",
          description: "Your sponsored ad has been deleted successfully.",
          className: "bg-green-600 text-white border-green-700"
        });
      } else {
        toast({
          title: "Delete Failed",
          description: result.error || "Failed to delete ad. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast({
        title: "Delete Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeletingAdId(null);
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
      const videos = (data || []).map((row: any) => row.video);
      setSavedVideos(videos);

      // Fetch view counts for saved videos
      if (videos && videos.length > 0) {
        await fetchViewCounts(videos);
      }
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

        const followersList = profilesData || [];
        setFollowers(followersList);

        // Check follow status for each follower
        if (user && followersList.length > 0) {
          checkFollowerFollowStatus(followersList);
        }
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
    if (!profile?.user_id) return;

    setRemovingId(targetUserId);

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', targetUserId)
      .eq('following_id', profile.user_id);

    if (!error) {
      // Update UI immediately for better user experience
      setFollowers(prev => prev.filter((u) => u.user_id !== targetUserId));
      setFollowersCount(prev => Math.max(0, prev - 1));

      // Fetch the latest counts to ensure accuracy
      fetchFollowCounts();

      toast({
        title: 'Success',
        description: 'Follower removed successfully'
      });
    } else {
      console.error('Error removing follower:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove follower',
        variant: 'destructive'
      });
    }

    setRemovingId(null);
  };

  // Check follow status for followers in the modal
  const checkFollowerFollowStatus = async (followersList: any[]) => {
    if (!user || followersList.length === 0) return;

    try {
      const followerIds = followersList.map(f => f.user_id);
      const { data: followData, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', followerIds);

      if (!error && followData) {
        const followingSet = new Set(followData.map(f => f.following_id));
        const statusMap: { [userId: string]: boolean } = {};

        followersList.forEach(follower => {
          statusMap[follower.user_id] = followingSet.has(follower.user_id);
        });

        setFollowerFollowStatus(statusMap);
      }
    } catch (error) {
      console.error('Error checking follower follow status:', error);
    }
  };

  // Handle follow/unfollow for followers in modal
  const handleFollowerToggle = async (targetUserId: string) => {
    if (!user || followLoading) return;

    setFollowLoading(true);
    const wasFollowing = followerFollowStatus[targetUserId];

    try {
      if (wasFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (!error) {
          setFollowerFollowStatus(prev => ({ ...prev, [targetUserId]: false }));
        }
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });

        if (!error) {
          setFollowerFollowStatus(prev => ({ ...prev, [targetUserId]: true }));
        }
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
    }

    setFollowLoading(false);
  };

  // Search users function
  const searchUsers = async (query: string) => {
    if (query.length < 1) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    setSearchingUsers(true);
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('user_id', user?.id) // Exclude current admin user
        .limit(10);

      if (!error && users) {
        setUserSearchResults(users);
        setShowUserDropdown(true);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
    setSearchingUsers(false);
  };

  // Handle username input change
  const handleUsernameChange = (value: string) => {
    setPushNotification(prev => ({ ...prev, targetUsername: value }));
    searchUsers(value);
  };

  // Select user from dropdown
  const selectUser = (username: string) => {
    setPushNotification(prev => ({ ...prev, targetUsername: username }));
    setShowUserDropdown(false);
    setUserSearchResults([]);
  };

  // Send push notification function
  const sendPushNotification = async () => {
    if (!pushNotification.title.trim() || !pushNotification.message.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in both title and message',
        variant: 'destructive'
      });
      return;
    }

    if (pushNotification.type === 'individual' && !pushNotification.targetUsername.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a username for individual notification',
        variant: 'destructive'
      });
      return;
    }

    setSendingPush(true);

    try {
      if (pushNotification.type === 'all') {
        // Send to all users including admin (admin won't see it in inbox but will see it in sent tab)
        const { data: allUsers, error: usersError } = await supabase
          .from('profiles')
          .select('user_id');

        if (usersError) {
          throw usersError;
        }

        if (allUsers.length === 0) {
          toast({
            title: 'Info',
            description: 'No users to send notification to',
            variant: 'default'
          });
          return;
        }

        // Insert notifications for all users (including admin)
        // Add a special marker for "All Users" notifications
        const notifications = allUsers.map(userProfile => ({
          to_user_id: userProfile.user_id,
          from_user_id: user?.id,
          type: 'admin',
          title: pushNotification.title,
          message: `[ALL_USERS] ${pushNotification.message}`,
          recipient_count: allUsers.length
        }));

        console.log('About to save All Users notifications:', {
          count: notifications.length,
          sampleMessage: notifications[0]?.message,
          sampleNotification: notifications[0]
        });

        const { error: insertError } = await supabase
          .from('system_notifications' as any)
          .insert(notifications);

        if (insertError) {
          throw insertError;
        }

        toast({
          title: 'Success',
          description: `Push notification sent to all users (${allUsers.length} users)`,
          className: "bg-green-600 text-white border-green-700"
        });

        // Refresh sent notifications instead of page reload
        fetchSentNotifications();
      } else {
        // Send to individual user
        const { data: targetUser, error: userError } = await supabase
          .from('profiles')
          .select('user_id, username')
          .eq('username', pushNotification.targetUsername.trim())
          .single();

        if (userError || !targetUser) {
          toast({
            title: 'Error',
            description: 'User not found or invalid selection',
            variant: 'destructive'
          });
          setSendingPush(false);
          return;
        }

        // For individual notifications, we'll add a special prefix to help identify the recipient
        const targetUsername = targetUser.username;
        const notificationTitle = pushNotification.title;
        const notificationMessage = `[TO:${targetUsername}] ${pushNotification.message}`;

        console.log('About to save individual notification:', {
          targetUsername,
          message: notificationMessage,
          originalMessage: pushNotification.message
        });

        // Send to both the target user and admin (for sent tab tracking)
        const notifications = [
          {
            to_user_id: targetUser.user_id,
            from_user_id: user?.id,
            type: 'admin',
            title: notificationTitle,
            message: notificationMessage,
            sent_to_username: targetUsername,
            recipient_count: 1
          }
        ];

        // Also send to admin if they're not the target user (for sent tab tracking)
        if (targetUser.user_id !== user?.id) {
          notifications.push({
            to_user_id: user?.id,
            from_user_id: user?.id,
            type: 'admin_tracking',
            title: notificationTitle,
            message: notificationMessage,
            sent_to_username: targetUsername,
            recipient_count: 1
          });
        }

        console.log('Individual notifications to insert:', notifications);

        const { error: insertError } = await supabase
          .from('system_notifications' as any)
          .insert(notifications);

        if (insertError) {
          throw insertError;
        }

        toast({
          title: 'Success',
          description: `Push notification sent to @${targetUser.username}`,
          className: "bg-green-600 text-white border-green-700"
        });

        // Refresh sent notifications instead of page reload
        fetchSentNotifications();
      }

      // Reset form
      setPushNotification({
        type: 'all',
        targetUsername: '',
        title: '',
        message: ''
      });

    } catch (error) {
      console.error('Error sending push notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send push notification',
        variant: 'destructive'
      });
    }

    setSendingPush(false);
  };

  // Fetch sent notifications
  const fetchSentNotifications = async () => {
    if (!user || !isAdmin) {
      return;
    }

    // Debug JWT and user context
    const session = await supabase.auth.getSession();
    console.log('JWT/User Debug Info:', {
      userId: user?.id,
      userEmail: user?.email,
      isAdmin,
      sessionUserId: session.data.session?.user?.id,
      sessionUserEmail: session.data.session?.user?.email,
      jwtPayload: session.data.session?.access_token ?
        JSON.parse(atob(session.data.session.access_token.split('.')[1])) : null,
      timestamp: new Date().toISOString()
    });

    setLoadingSentNotifications(true);
    try {
      // Fetch notifications without the relationship - include both 'admin' and 'admin_tracking' types
      const { data: notifications, error } = await supabase
        .from('system_notifications' as any)
        .select('*')
        .eq('from_user_id', user.id)
        .in('type', ['admin', 'admin_tracking'])
        .order('created_at', { ascending: false })
        .limit(50);





      console.log('Raw notifications query result:', {
        notifications: notifications?.slice(0, 3), // Show first 3 for debugging
        error,
        totalCount: notifications?.length
      });

      if (error) {
        console.error('Error fetching sent notifications:', error);
        setSentNotifications([]);
      } else if (notifications && Array.isArray(notifications) && notifications.length > 0) {
        console.log('Found notifications:', notifications.length);

        // Type guard to ensure we have valid notification objects
        const validNotifications = notifications.filter((n: any) =>
          n && typeof n === 'object' && 'id' in n && 'from_user_id' in n
        );

        if (validNotifications.length === 0) {
          setSentNotifications([]);
          setLoadingSentNotifications(false);
          return;
        }

        // Get unique user IDs from notifications
        const userIds = [...new Set(validNotifications.map((n: any) => n.to_user_id).filter(Boolean))];

        // Fetch user profiles separately
        let userProfiles: any = {};
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url')
            .in('user_id', userIds);

          if (!profilesError && profiles) {
            // Create a map of user_id to profile
            userProfiles = profiles.reduce((acc: any, profile: any) => {
              acc[profile.user_id] = profile;
              return acc;
            }, {});
          }
        }

        // Group notifications by title and message to identify related notifications
        const notificationGroups = validNotifications.reduce((groups: any, notification: any) => {
          const key = `${notification.title}-${notification.message}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(notification);
          return groups;
        }, {});

        // For individual notifications, we need to ensure admin_tracking notifications are properly handled
        // Remove admin_tracking notifications that are duplicates of regular admin notifications
        Object.keys(notificationGroups).forEach(key => {
          const group = notificationGroups[key];
          if (group.length > 1) {
            // Check if this is an individual notification (has [TO:username] marker)
            const messageText = group[0].message || '';
            const individualMatch = messageText.match(/^\[TO:([^\]]+)\]/);

            if (individualMatch) {
              // For individual notifications, prioritize the admin notification over admin_tracking
              const adminNotifications = group.filter((n: any) => n.type === 'admin');
              const trackingNotifications = group.filter((n: any) => n.type === 'admin_tracking');

              if (adminNotifications.length > 0 && trackingNotifications.length > 0) {
                // Keep only the admin notification (the one sent to the actual recipient)
                notificationGroups[key] = adminNotifications;
              }
            }
          }
        });

        // Further filter groups to only include notifications sent within 2 minutes of each other
        Object.keys(notificationGroups).forEach(key => {
          const group = notificationGroups[key];
          if (group.length > 1) {
            // Sort by creation time
            group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            // Only keep notifications that are within 2 minutes of the first one
            const firstTime = new Date(group[0].created_at).getTime();
            notificationGroups[key] = group.filter((n: any) => {
              const notificationTime = new Date(n.created_at).getTime();
              return (notificationTime - firstTime) <= 120000; // 2 minutes
            });
          }
        });

        // Create display notifications - one per group, sorted by creation time
        const notificationsWithUsers = Object.values(notificationGroups)
          .map((group: any) => {
            const firstNotification = group[0];
            let isAllUsers = false;
            let targetUser = null;

            // Check if this is an individual notification using the sent_to_username column
            const messageText = firstNotification.message || '';
            const sentToUsername = firstNotification.sent_to_username;



            const allUsersMatch = messageText.match(/^\[ALL_USERS\]/);

            if (allUsersMatch) {
              isAllUsers = true;
              targetUser = null;
            } else if (sentToUsername) {
              // This is an individual notification - use the sent_to_username column
              isAllUsers = false;
              targetUser = Object.values(userProfiles).find((profile: any) =>
                profile.username === sentToUsername
              );
              
              // If we can't find the user in profiles, create a fallback user object
              if (!targetUser) {
                targetUser = {
                  username: sentToUsername,
                  display_name: sentToUsername,
                  avatar_url: null,
                  user_id: firstNotification.to_user_id
                };
              }

            } else {
              // Fallback: check message for markers (for old notifications)
              const individualMatch = messageText.match(/^\[TO:([^\]]+)\]/);
              if (individualMatch) {
                isAllUsers = false;
                const targetUsername = individualMatch[1];
                targetUser = Object.values(userProfiles).find((profile: any) =>
                  profile.username === targetUsername
                );
                
                // If we can't find the user in profiles, create a fallback user object
                if (!targetUser) {
                  targetUser = {
                    username: targetUsername,
                    display_name: targetUsername,
                    avatar_url: null,
                    user_id: firstNotification.to_user_id
                  };
                }
              } else {
                // For notifications without markers, check if it's sent to multiple users
                const uniqueRecipients = new Set(group.map((n: any) => n.to_user_id));
                console.log('Unique recipients count:', uniqueRecipients.size);

                // If there are many unique recipients, it's "All Users"
                if (uniqueRecipients.size > 5) {
                  isAllUsers = true;
                  targetUser = null;
                } else {
                  // For small groups, it's likely individual notifications
                  isAllUsers = false;
                  targetUser = userProfiles[firstNotification.to_user_id];
                }
              }
            }

            // Clean up the message by removing the markers for display
            let cleanMessage = messageText;
            if (sentToUsername || messageText.match(/^\[TO:[^\]]+\]/)) {
              cleanMessage = messageText.replace(/^\[TO:[^\]]+\]\s*/, '');
            } else if (allUsersMatch) {
              cleanMessage = messageText.replace(/^\[ALL_USERS\]\s*/, '');
            }

            console.log('Message cleaning:', {
              original: messageText,
              cleaned: cleanMessage
            });

            // Use stored recipient count if available, otherwise calculate
            let recipientCount = firstNotification.recipient_count;

            if (!recipientCount) {
              // Fallback calculation for older notifications without recipient_count
              if (allUsersMatch) {
                // For all users notifications, count unique recipients
                const uniqueRecipients = new Set(group.map((n: any) => n.to_user_id));
                recipientCount = uniqueRecipients.size;
              } else if (sentToUsername) {
                // For individual notifications (identified by sent_to_username), always show 1
                recipientCount = 1;
              } else {
                // For other notifications, count unique recipients
                const uniqueRecipients = new Set(group.map((n: any) => n.to_user_id));
                recipientCount = uniqueRecipients.size;
              }
            }

            console.log('Final notification data:', {
              isAllUsers,
              recipientCount,
              targetUser: targetUser?.username,
              sentToUsername,
              availableProfiles: Object.values(userProfiles).map((p: any) => p.username),
              cleanMessage: cleanMessage.substring(0, 50) + '...'
            });

            return {
              ...firstNotification,
              message: cleanMessage, // Use cleaned message for display
              to_user: targetUser,
              recipient_count: recipientCount,
              is_all_users: isAllUsers
            };
          })
          .filter((notification: any) => notification !== null) // Remove null entries
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setSentNotifications(notificationsWithUsers);
      } else {
        setSentNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching sent notifications:', error);
      setSentNotifications([]);
    }
    setLoadingSentNotifications(false);
  };

  // Auto-fetch sent notifications when admin profile loads
  useEffect(() => {
    if (isAdmin && isOwnProfile && user?.id) {
      fetchSentNotifications();
    }
  }, [isAdmin, isOwnProfile, user?.id]);

  // Helper to get total likes received (only sum from userVideos)
  const getTotalLikes = () => {
    if (!Array.isArray(userVideos)) return 0;
    return userVideos.reduce((sum, v) => sum + (v.like_count || 0), 0);
  };

  // Helper to format time for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Fetch actual follow counts
  const fetchFollowCounts = async () => {
    if (!profile?.user_id) return;



    try {
      // Get following count with retry logic
      try {
        const { data: followingData, error: followingError, count: followingCount } = await supabase
          .from('follows' as any)
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', profile.user_id);

        if (followingError) {
          console.error('Error fetching following count:', followingError);
          // Keep current count on error
        } else {
          setFollowingCount(followingCount || 0);
        }
      } catch (followingFetchError) {
        console.error('Network error fetching following count:', followingFetchError);
        // Keep current following count on network error
      }

      // Get followers count with retry logic
      try {
        const { data: followersData, error: followersError, count: followersCount } = await supabase
          .from('follows' as any)
          .select('id', { count: 'exact', head: true })
          .eq('following_id', profile.user_id);

        if (followersError) {
          console.error('Error fetching followers count:', followersError);
          // Keep current count on error
        } else {
          setFollowersCount(followersCount || 0);
        }
      } catch (followersFetchError) {
        console.error('Network error fetching followers count:', followersFetchError);
        // Keep current followers count on network error
      }

    } catch (error) {
      console.error('Error fetching follow counts:', error);
      // Only show toast for persistent errors, not network issues
      if (!error.message?.includes('Failed to fetch')) {
        toast({
          title: 'Error',
          description: 'Failed to update follow counts. Please refresh the page.',
          variant: 'destructive',
        });
      }
    }
  };

  // Check if current user is following this profile
  const checkFollowStatus = async () => {
    if (!user || !profile?.user_id) return;

    console.log('Checking follow status for current user:', user.id, 'to profile:', profile.user_id);

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profile.user_id)
        .single();

      const isCurrentlyFollowing = !error && data;
      console.log('Follow status result:', isCurrentlyFollowing ? 'Following' : 'Not following');

      setIsFollowing(!!isCurrentlyFollowing);
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
        .from('chats')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.user_id}),and(sender_id.eq.${profile.user_id},receiver_id.eq.${user.id})`);

      if (error) {
        console.error('Error checking for existing chat:', error);
        toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
        return;
      }

      console.log('Found existing chats:', existingChats);

      // Filter out deleted chats when looking for existing chats
      const nonDeletedChats = (existingChats || []).filter((chat: any) => {
        if (chat.sender_id === user.id) {
          return !chat.deleted_for_sender;
        } else {
          return !chat.deleted_for_receiver;
        }
      });

      const filteredExistingChat = nonDeletedChats.length > 0 ? nonDeletedChats[0] : null;
      console.log('Using existing chat:', filteredExistingChat);

      let chatId;

      if (filteredExistingChat) {
        console.log('Found existing non-deleted chat:', filteredExistingChat.id);
        chatId = filteredExistingChat.id;

        // Update chat's last message and timestamp
        const { error: updateError } = await supabase
          .from('chats')
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
          .from('chats')
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
        .from('messages')
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


  if (loading || authLoading) {
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
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-2 border-primary cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  console.log('Profile image clicked');
                  setShowProfileImageModal(true);
                }}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{profile?.display_name || profile?.username || 'User'}</h2>
          <p className="text-muted-foreground mb-2">@{profile?.username || 'user'}</p>
          {profile?.bio && (
            <p className="text-foreground text-sm mb-4 max-w-xs text-center">{profile.bio}</p>
          )}
          {isOwnProfile && (
            <>
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-sm text-muted-foreground">TrinECredits:</span>
                <Badge variant="secondary" className="bg-green-900 text-green-400">
                  TT${walletBalance !== null ? walletBalance.toFixed(2) : '0.00'}
                </Badge>
              </div>
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/edit-profile')}
                  className="flex-1"
                >
                  Edit Profile
                </Button>
                <Button
                  variant="neon"
                  size="sm"
                  onClick={() => navigate('/boost')}
                  className="flex-1"
                >
                  Boost
                </Button>
              </div>
            </>
          )}
          {isOwnProfile && !isAdmin && (
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

            {/* Admin crown button or Message button */}
            {isAdmin ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/admin')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white min-w-[100px]"
                title="Admin Dashboard"
              >
                👑 Admin
              </Button>
            ) : isFollowing && (
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
        <Tabs defaultValue={isAdmin ? "push" : "videos"} className="w-full">
          <TabsList className={`grid w-full ${isAdmin && isOwnProfile ? 'grid-cols-3' : isOwnProfile ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {isAdmin ? (
              <>
                <TabsTrigger value="push" className={!isOwnProfile ? 'justify-center' : ''}>
                  <Bell className="inline mr-1" size={16} />Push
                </TabsTrigger>
                {isOwnProfile && (
                  <TabsTrigger value="sent">
                    <Send className="inline mr-1" size={16} />Sent
                  </TabsTrigger>
                )}
                {isOwnProfile && (
                  <TabsTrigger value="ads">
                    <TrendingUp className="inline mr-1" size={16} />My Ads
                  </TabsTrigger>
                )}
              </>
            ) : (
              <TabsTrigger value="videos" className={!isOwnProfile ? 'justify-center' : ''}>
                Videos
              </TabsTrigger>
            )}
            {isOwnProfile && !isAdmin && (
              <>
                <TabsTrigger value="saved">
                  <Bookmark className="inline mr-1" size={16} />Saved
                </TabsTrigger>
                <TabsTrigger value="ads">
                  <TrendingUp className="inline mr-1" size={16} />My Ads
                </TabsTrigger>
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
                      <span className="text-xs text-white font-semibold">{formatViews(viewCounts[video.id] || 0)}</span>
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
          {/* My Ads tab for own profile only */}
          {isOwnProfile && (
            <TabsContent value="ads" className="mt-4">
              {/* Ad Stats Button */}
              <div className="flex justify-center mb-6">
                <Button
                  onClick={() => navigate('/ad-stats')}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                >
                  <TrendingUp size={16} />
                  Ad Stats
                </Button>
              </div>

              {sponsoredAds.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {sponsoredAds.map((ad) => (
                    <Card
                      key={ad.id}
                      className="relative aspect-[9/16] cursor-pointer group bg-black/10 overflow-hidden hover:bg-black/20 transition-colors"
                      onClick={() => navigate(`/campaign/${ad.id}`)}
                    >
                      {/* Status badge top left */}
                      <div className="absolute top-2 left-2 z-10">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${ad.status === 'active' ? 'bg-green-900 text-green-400' :
                            ad.status === 'pending' ? 'bg-yellow-900 text-yellow-400' :
                              ad.status === 'approved' ? 'bg-blue-900 text-blue-400' :
                                ad.status === 'rejected' ? 'bg-red-900 text-red-400' :
                                  ad.status === 'expired' ? 'bg-gray-900 text-gray-400' :
                                    'bg-purple-900 text-purple-400'
                            }`}
                        >
                          {ad.status === 'active' ? '🟢' :
                            ad.status === 'pending' ? '⏳' :
                              ad.status === 'approved' ? '✅' :
                                ad.status === 'rejected' ? '❌' :
                                  ad.status === 'expired' ? '⏰' : '📝'}
                        </Badge>
                      </div>

                      {/* 3-dots menu top right */}
                      <div className="absolute top-2 right-2 z-10">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 bg-black/70 hover:bg-black/90 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAdMenu(showAdMenu === ad.id ? null : ad.id);
                            }}
                          >
                            <MoreVertical size={16} className="text-white" />
                          </Button>

                          {/* Dropdown Menu - Centered in card */}
                          {showAdMenu === ad.id && (
                            <div className="fixed inset-0 z-30 flex items-center justify-center" onClick={(e) => {
                              e.stopPropagation();
                              setShowAdMenu(null);
                            }}>
                              <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-lg py-2 min-w-[100px]" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="w-full px-3 py-2 text-center text-sm text-white hover:bg-white/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/campaign/${ad.id}`);
                                    setShowAdMenu(null);
                                  }}
                                >
                                  Statistics
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-center text-sm text-red-400 hover:bg-white/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAd(ad.id);
                                  }}
                                  disabled={deletingAdId === ad.id}
                                >
                                  {deletingAdId === ad.id ? 'Deleting...' : 'Delete Ad'}
                                </button>
                                <button
                                  className="w-full px-3 py-2 text-center text-sm text-white hover:bg-white/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAdMenu(null);
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ad thumbnail */}
                      {ad.thumbnail_url ? (
                        <img
                          src={ad.thumbnail_url}
                          alt={ad.title}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-thumbnail.png';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">
                          No Cover
                        </div>
                      )}

                      {/* Duration badge bottom right */}
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                          {ad.duration}s
                        </Badge>
                      </div>

                      {/* Ad title bottom left */}
                      <div className="absolute bottom-2 left-2 right-12">
                        <p className="text-xs text-white font-medium truncate bg-black/70 px-2 py-1 rounded">
                          {ad.title}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp size={32} className="text-white/70" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">No ads yet</h3>
                  <p className="text-white/70 mb-4">
                    Create your first sponsored ad to reach more viewers
                  </p>
                  <Button
                    onClick={() => navigate('/boost')}
                    variant="neon"
                    className="bg-primary text-black hover:bg-primary/90"
                  >
                    Create Your First Ad
                  </Button>
                </div>
              )}
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
                      <span className="text-xs text-white font-semibold">{formatViews(viewCounts[video.id] || 0)}</span>
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

          {/* Push Notifications tab for admin only */}
          {isAdmin && (
            <TabsContent value="push" className="mt-4">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Admin Message Center</h2>
                  <p className="text-white/70">Send push notifications to users</p>
                </div>

                <Card className="p-6 bg-black/20 border-white/10">
                  <div className="space-y-4">
                    {/* Notification Type */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Send To
                      </label>
                      <Select
                        value={pushNotification.type}
                        onValueChange={(value) => setPushNotification(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger className="bg-black/30 border-white/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="individual">Individual User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Target Username (only for individual) */}
                    {pushNotification.type === 'individual' && (
                      <div className="relative">
                        <label className="block text-sm font-medium text-white mb-2">
                          Username
                        </label>
                        <div className="relative">
                          <Input
                            placeholder="Start typing username..."
                            value={pushNotification.targetUsername}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            onFocus={() => {
                              if (pushNotification.targetUsername.length >= 1) {
                                setShowUserDropdown(true);
                              }
                            }}
                            className="bg-black/30 border-white/20 text-white placeholder-white/50"
                          />
                          {searchingUsers && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            </div>
                          )}
                        </div>

                        {/* User Search Dropdown */}
                        {showUserDropdown && userSearchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-black/90 border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {userSearchResults.map((user) => (
                              <div
                                key={user.user_id}
                                className="flex items-center gap-3 p-3 hover:bg-white/10 cursor-pointer transition-colors"
                                onClick={() => selectUser(user.username)}
                              >
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={user.avatar_url} alt={user.username} />
                                  <AvatarFallback className="bg-white/10 text-white text-xs">
                                    {user.username?.charAt(0).toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-medium truncate">
                                    {user.display_name || user.username}
                                  </div>
                                  <div className="text-white/60 text-sm truncate">
                                    @{user.username}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* No results message */}
                        {showUserDropdown && userSearchResults.length === 0 && pushNotification.targetUsername.length >= 1 && !searchingUsers && (
                          <div className="absolute z-10 w-full mt-1 bg-black/90 border border-white/20 rounded-lg shadow-lg p-3">
                            <div className="text-white/60 text-sm text-center">
                              No users found matching "{pushNotification.targetUsername}"
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Title
                      </label>
                      <Input
                        placeholder="Notification title"
                        value={pushNotification.title}
                        onChange={(e) => setPushNotification(prev => ({ ...prev, title: e.target.value }))}
                        className="bg-black/30 border-white/20 text-white placeholder-white/50"
                        maxLength={100}
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Message
                      </label>
                      <Textarea
                        placeholder="Notification message"
                        value={pushNotification.message}
                        onChange={(e) => setPushNotification(prev => ({ ...prev, message: e.target.value }))}
                        className="bg-black/30 border-white/20 text-white placeholder-white/50 min-h-[100px]"
                        maxLength={500}
                      />
                      <div className="text-xs text-white/50 mt-1">
                        {pushNotification.message.length}/500 characters
                      </div>
                    </div>

                    {/* Send Button */}
                    <Button
                      onClick={sendPushNotification}
                      disabled={sendingPush || !pushNotification.title.trim() || !pushNotification.message.trim()}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                    >
                      {sendingPush ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send size={16} />
                          Send Push Notification
                        </div>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Sent Notifications tab for admin only */}
          {isAdmin && isOwnProfile && (
            <TabsContent value="sent" className="mt-4">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Sent Notifications</h2>
                  <p className="text-white/70">View your sent push notifications</p>
                </div>

                {loadingSentNotifications ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white/70">Loading sent notifications...</p>
                  </div>
                ) : sentNotifications.length > 0 ? (
                  <div className="space-y-4">
                    {sentNotifications.map((notification) => (
                      <Card
                        key={notification.id}
                        className="p-4 bg-black/20 border-white/10 cursor-pointer hover:bg-black/30 transition-colors"
                        onClick={() => {
                          setSelectedNotification(notification);
                          setShowNotificationModal(true);
                        }}
                      >
                        <div className="flex items-start gap-4">
                          {/* Notification Icon */}
                          <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Shield size={20} className="text-white" />
                          </div>

                          {/* Notification Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-white font-semibold truncate">
                                {notification.title}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-white/60 flex-shrink-0">
                                <span>{formatTime(notification.created_at)}</span>
                              </div>
                            </div>

                            {/* Show only title initially, full message on click */}
                            <p className="text-white/60 text-sm mb-3">
                              Click to view full message
                            </p>

                            {/* Recipient Info - without "Sent to:" text */}
                            <div className="flex items-center gap-2">
                              {notification.is_all_users ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/70">All Users</span>
                                  <span className="text-xs text-white/50">({notification.recipient_count} recipients)</span>
                                </div>
                              ) : notification.to_user ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-5 h-5">
                                    <AvatarImage src={notification.to_user.avatar_url} alt={notification.to_user.username} />
                                    <AvatarFallback className="bg-white/10 text-white text-xs">
                                      {notification.to_user.username?.charAt(0).toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-white/70">
                                    @{notification.to_user.username}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-white/70">Unknown Recipient</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send size={32} className="text-white/70" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white">No notifications sent yet</h3>
                    <p className="text-white/70">
                      Your sent push notifications will appear here
                    </p>
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
            <h3 className="text-2xl font-bold text-primary logo-text-glow">Followers ({followersCount})</h3>
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
                  <div className="flex items-center gap-2">
                    {/* Follow/Unfollow button - show if user is logged in and not the follower themselves */}
                    {user && f.user_id !== user.id && (
                      <button
                        className={clsx(
                          "p-2 rounded-full transition-colors",
                          followerFollowStatus[f.user_id]
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white",
                          followLoading && "opacity-50 pointer-events-none"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowerToggle(f.user_id);
                        }}
                        disabled={followLoading}
                        title={followerFollowStatus[f.user_id] ? "Unfollow" : "Follow"}
                      >
                        {followerFollowStatus[f.user_id] ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    )}

                    {/* Remove button - only show if viewing own profile */}
                    {isOwnProfile && (
                      <button
                        className={clsx(
                          "p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors",
                          removingId === f.user_id && "opacity-50 pointer-events-none"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFollower(f.user_id);
                        }}
                        disabled={removingId === f.user_id}
                        title="Remove follower"
                      >
                        <UserMinus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-2xl font-bold text-primary logo-text-glow">Following ({followingCount})</h3>
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
                    className={clsx(
                      "p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors",
                      removingId === f.user_id && "opacity-50 pointer-events-none"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFollowing(f.user_id);
                    }}
                    disabled={removingId === f.user_id}
                  >
                    <UserMinus size={16} />
                  </button>
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

      {/* Profile Image Modal - Fullscreen */}
      {showProfileImageModal && profile?.avatar_url && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onClick={() => setShowProfileImageModal(false)}
        >
          {/* Header with close button */}
          <div className="p-4 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowProfileImageModal(false)}
              className="bg-black/50 hover:bg-black/70 text-white"
            >
              <X size={24} />
            </Button>
          </div>

          {/* Image container - takes full available height with bottom spacing */}
          <div className="flex-1 flex items-center justify-center p-4 pb-24">
            <img
              src={profile.avatar_url}
              alt="Profile"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {showNotificationModal && selectedNotification && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onClick={() => setShowNotificationModal(false)}
        >
          <div
            className="w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Push Notification</h2>
                  <p className="text-sm text-white/60">{formatTime(selectedNotification.created_at)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotificationModal(false)}
                className="text-white hover:bg-white/10"
              >
                <X size={24} />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 space-y-6 overflow-y-auto">
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-white/70 block mb-2">Title</label>
                <p className="text-white font-semibold text-lg">{selectedNotification.title}</p>
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-white/70 block mb-2">Message</label>
                <div className="bg-black/40 border border-white/10 rounded-lg p-4">
                  <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                    {selectedNotification.message}
                  </p>
                </div>
              </div>

              {/* Recipient Info */}
              <div>
                <label className="text-sm font-medium text-white/70 block mb-2">Sent to</label>
                <div className="bg-black/40 border border-white/10 rounded-lg p-4">
                  {selectedNotification.is_all_users ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <Bell size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">All Users</p>
                        <p className="text-white/60 text-sm">{selectedNotification.recipient_count} recipients</p>
                      </div>
                    </div>
                  ) : selectedNotification.to_user ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={selectedNotification.to_user.avatar_url} alt={selectedNotification.to_user.username} />
                        <AvatarFallback className="bg-white/10 text-white text-sm">
                          {selectedNotification.to_user.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-white font-medium">{selectedNotification.to_user.display_name || selectedNotification.to_user.username}</p>
                        <p className="text-white/60 text-sm">@{selectedNotification.to_user.username}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/70">Unknown Recipient</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
              <Button
                onClick={() => setShowNotificationModal(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20 h-12 text-lg"
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
