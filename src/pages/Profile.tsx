import ModalVerticalFeed from "@/components/ModalVerticalFeed";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import { MoreVertical, Settings, Send, Wallet, Heart, Bookmark, Eye } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import WalletModal from "@/components/WalletModal";
import { getTrincreditsBalance } from "@/lib/ttpaypalApi";
import { Avatar } from "@/components/ui/avatar";
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
        (payload) => {
          console.log('Video update received:', payload);
          if (payload.eventType === 'UPDATE') {
            setUserVideos(prev => 
              prev.map(video => 
                video.id === payload.new.id ? { ...video, ...payload.new } : video
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setUserVideos(prev => prev.filter(video => video.id !== payload.old.id));
          } else if (payload.eventType === 'INSERT') {
            setUserVideos(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id]);

  useEffect(() => {
    fetchProfile();
    if (isOwnProfile) fetchSavedVideos();
  }, [username, user, isOwnProfile]);



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
      const { data: dbVideos, error: dbError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
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
        .from('follows')
        .select('follower_id, profiles:profiles!follows_follower_id_fkey(username, avatar_url, user_id)')
        .eq('following_id', profile.user_id);
      setFollowers((data || []).map((row: any) => row.profiles));
    } finally {
      setLoadingFollowers(false);
    }
  };
  const fetchFollowing = async () => {
    if (!profile?.user_id) return;
    setLoadingFollowing(true);
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('following_id, profiles:profiles!follows_following_id_fkey(username, avatar_url, user_id)')
        .eq('follower_id', profile.user_id);
      setFollowing((data || []).map((row: any) => row.profiles));
    } finally {
      setLoadingFollowing(false);
    }
  };
  // Remove user from following
  const handleRemoveFollowing = async (targetUserId: string) => {
    setRemovingId(targetUserId);
    await supabase.from('follows').delete().eq('follower_id', profile.user_id).eq('following_id', targetUserId);
    setFollowing(following.filter((u) => u.user_id !== targetUserId));
    setRemovingId(null);
  };
  // Remove user from followers
  const handleRemoveFollower = async (targetUserId: string) => {
    setRemovingId(targetUserId);
    await supabase.from('follows').delete().eq('follower_id', targetUserId).eq('following_id', profile.user_id);
    setFollowers(followers.filter((u) => u.user_id !== targetUserId));
    setRemovingId(null);
  };

  // Helper to get total likes received (only sum from userVideos)
  const getTotalLikes = () => userVideos.reduce((sum, v) => sum + (v.like_count || 0), 0);

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
          <h2 className="text-2xl font-bold text-foreground mb-1">@{profile?.username || 'user'}</h2>
          <p className="text-muted-foreground mb-4">{profile?.display_name || profile?.email}</p>
          {isOwnProfile && (
            <div className="flex items-center space-x-2 mb-6">
              <span className="text-sm text-muted-foreground">TriniCredits:</span>
              <Badge variant="secondary" className="bg-green-900 text-green-400">
                TT${walletBalance !== null ? walletBalance.toFixed(2) : '0.00'}
              </Badge>
            </div>
          )}
          {isOwnProfile && (
            <div className="flex items-center justify-center gap-8 mb-4">
              <button
                className="flex flex-col items-center group"
                onClick={() => { fetchFollowing(); setShowFollowingModal(true); }}
              >
                <span className="text-lg font-bold text-white group-hover:text-primary transition">{profile?.following_count || 0}</span>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition">Following</span>
              </button>
              <button
                className="flex flex-col items-center group"
                onClick={() => { fetchFollowers(); setShowFollowersModal(true); }}
              >
                <span className="text-lg font-bold text-white group-hover:text-primary transition">{profile?.follower_count || 0}</span>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition">Followers</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-white">{getTotalLikes()}</span>
                <span className="text-xs text-muted-foreground">Likes</span>
              </div>
            </div>
          )}
          {/* Stats, Bio, Badges, etc. can go here */}
        </div>
      </div>
      {/* Tabs and Videos */}
      <div className="px-4">
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="likes">Liked</TabsTrigger>
            {isOwnProfile && <TabsTrigger value="saved"><Bookmark className="inline mr-1" size={16}/>Saved</TabsTrigger>}
          </TabsList>
          <TabsContent value="videos" className="mt-4">
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
                    <img src={supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl} alt={video.title} className="w-full h-full object-cover rounded" />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">No Cover</div>
                  )}
                  {/* View icon and count bottom left */}
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                      {(() => { const d = Number(video.duration); if (!d || isNaN(d) || d < 0) return '0:00'; const mins = Math.floor(d / 60); const secs = Math.floor(d % 60); return `${mins}:${secs.toString().padStart(2, '0')}`; })()}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="likes" className="mt-4">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Your liked videos will appear here</p>
            </div>
          </TabsContent>
          {isOwnProfile && (
            <TabsContent value="saved" className="mt-4">
              <div className="grid grid-cols-3 gap-2">
                {savedVideos.map((video, idx) => (
                  <Card key={video.id} className="relative aspect-[9/16] cursor-pointer group bg-black/10 overflow-hidden"
                    onClick={() => { setCurrentVideoIndex(idx); setModalVideos(savedVideos); setShowVideoModal(true); }}>
                    {/* Like icon and count top left */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/70 rounded-full px-2 py-1">
                      <Heart size={16} className="text-red-500" />
                      <span className="text-xs text-white font-semibold">{video.like_count || 0}</span>
                    </div>
                    {video.thumbnail_url ? (
                      <img src={supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl} alt={video.title} className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">No Cover</div>
                    )}
                    {/* View icon and count bottom left */}
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
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <div className="w-full max-w-md mx-auto space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {loadingFollowers ? (
                <div className="text-white text-center">Loading...</div>
              ) : followers.length === 0 ? (
                <div className="text-white text-center">No followers yet</div>
              ) : followers.map((f) => (
                <div key={f.user_id} className="flex items-center justify-between bg-black/80 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={f.avatar_url || undefined} alt={f.username} />
                      <AvatarFallback>{f.username?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-white font-semibold">@{f.username}</span>
                  </div>
                  <button
                    className={clsx("text-red-500 font-bold ml-4", removingId === f.user_id && "opacity-50 pointer-events-none")}
                    onClick={() => handleRemoveFollower(f.user_id)}
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
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <div className="w-full max-w-md mx-auto space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {loadingFollowing ? (
                <div className="text-white text-center">Loading...</div>
              ) : following.length === 0 ? (
                <div className="text-white text-center">Not following anyone yet</div>
              ) : following.map((f) => (
                <div key={f.user_id} className="flex items-center justify-between bg-black/80 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={f.avatar_url || undefined} alt={f.username} />
                      <AvatarFallback>{f.username?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-white font-semibold">@{f.username}</span>
                  </div>
                  <button
                    className={clsx("text-red-500 font-bold ml-4", removingId === f.user_id && "opacity-50 pointer-events-none")}
                    onClick={() => handleRemoveFollowing(f.user_id)}
                    disabled={removingId === f.user_id}
                  >Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
