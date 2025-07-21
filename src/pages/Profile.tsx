import ModalVerticalFeed from "@/components/ModalVerticalFeed";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import { MoreVertical, Settings, Send, Wallet, Heart } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import WalletModal from "@/components/WalletModal";
import { getTrincreditsBalance } from "@/lib/ttpaypalApi";

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
  }, [username, user]);



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
        .select('*, profiles!inner(username, avatar_url)')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      setUserVideos(dbVideos || []);
    } catch (err) {
      console.error('Error fetching user videos:', err);
      setUserVideos([]);
    }
  };

  const handleDeleteVideo = async (videoId: string, videoUrl: string, thumbnailUrl?: string) => {
    if (!isOwnProfile) {
      alert("You can only delete your own videos.");
      return;
    }
    
    // Show confirmation dialog instead of window.confirm
    setConfirmAction({
      type: 'deleteVideo',
      videoId,
      videoUrl,
      thumbnailUrl
    });
    setShowConfirmDialog(true);
  };

  const confirmDeleteVideo = async () => {
    if (!confirmAction || confirmAction.type !== 'deleteVideo') return;
    
    try {
      const { videoId, videoUrl, thumbnailUrl } = confirmAction;
      
      // Remove from DB
      const { error: dbError } = await supabase.from('videos').delete().eq('id', videoId);
      if (dbError) {
        console.error('Error deleting video from DB:', dbError);
        toast({
          title: 'Failed to delete video from database.',
          description: dbError.message,
          variant: 'destructive',
        });
        return;
      }
      
      // Remove from storage (limeytt-uploads)
      if (videoUrl) {
        const path = videoUrl.split('/limeytt-uploads/')[1];
        if (path) await supabase.storage.from('limeytt-uploads').remove([path]);
      }
      if (thumbnailUrl) {
        const thumbPath = thumbnailUrl.split('/limeytt-uploads/')[1];
        if (thumbPath) await supabase.storage.from('limeytt-uploads').remove([thumbPath]);
      }
      
      // Refresh list
      fetchUserVideos(profile.user_id);
      
      // Show success message
      toast({
        title: 'Delete Successful..!',
        description: 'Your video has been removed from the feed also.',
        className: 'bg-green-600 text-white border-green-700'
      });
    } catch (error) {
      console.error('Error deleting video:', error);
      toast({
        title: 'Failed to delete video.',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };



  // State for avatar view modal (must be before any return)
  const [showViewModal, setShowViewModal] = useState(false);



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
          <span
            className="text-2xl font-black text-white tracking-wider logo-text-glow"
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: '900',
              letterSpacing: '0.15em',
              filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
            }}
          >
            {isOwnProfile ? 'Profile' : 'Viewing...'}
          </span>
          <div className="flex items-center space-x-2">
            {isOwnProfile ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowWalletModal(true)}>
                  <Wallet size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
                  <Settings size={16} />
                </Button>
                <Button variant="outline" size="sm" onClick={signOut}>Logout</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm">
                <MoreVertical size={16} />
              </Button>
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
                className="w-24 h-24 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            {/* Avatar is now clickable for full screen view, no camera button */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={() => setShowViewModal(true)}
              aria-label="View profile photo"
              tabIndex={0}
              role="button"
            ></div>
            {/* View Modal for Avatar */}
            {showViewModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setShowViewModal(false)}>
                <button className="absolute top-4 right-4 text-white text-2xl bg-black/60 rounded-full px-3 py-1" onClick={e => { e.stopPropagation(); setShowViewModal(false); }}>&times;</button>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="max-w-xs max-h-[80vh] rounded-lg border-2 border-primary bg-white" onClick={e => e.stopPropagation()} />
                ) : (
                  <img src="/limey-tree-logo.png" alt="Default Profile" className="max-w-xs max-h-[80vh] rounded-lg border-2 border-primary bg-white" onClick={e => e.stopPropagation()} />
                )}
              </div>
            )}
          </div>
          
          {/* Username */}
          <h2 className="text-2xl font-bold text-foreground mb-1">
            @{profile?.username || 'user'}
          </h2>
          
          {/* Display name */}
          <p className="text-muted-foreground mb-4">
            {profile?.display_name || profile?.email}
          </p>
          
          {/* Stats */}
          <div className="flex items-center space-x-6 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{profile?.likes_received || 0}</div>
              <div className="text-xs text-muted-foreground">Likes</div>
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {profile.bio}
            </p>
          )}

          {/* Creator Badge */}
          {profile?.is_creator && (
            <Badge className="mb-4">
              🎬 Creator
            </Badge>
          )}

          {/* TriniCredits Balance - Only show for own profile */}
          {isOwnProfile && (
            <div className="flex items-center space-x-2 mb-6">
              <span className="text-sm text-muted-foreground">TriniCredits:</span>
              <Badge variant="secondary" className="bg-green-900 text-green-400">
                TT${walletBalance !== null ? walletBalance.toFixed(2) : '0.00'}
              </Badge>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {isOwnProfile ? (
              <>
                <Button variant="outline" onClick={() => navigate('/edit-profile')}>
                  Edit Profile
                </Button>
                <Button 
                  variant="neon"
                  onClick={() => {
                    const profileUrl = `${window.location.origin}/profile/${profile?.username}`;
                    navigator.share({
                      title: `${profile?.display_name || profile?.username}'s Profile`,
                      text: `Check out ${profile?.display_name || profile?.username}'s profile on Limey!`,
                      url: profileUrl
                    }).catch(() => {
                      // Fallback: copy to clipboard
                      navigator.clipboard.writeText(profileUrl);
                    });
                  }}
                >
                  Share Profile
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="default"
                  size="sm"
                  onClick={() => navigate(`/message/${profile?.username || user?.id}`)}
                  className="flex items-center gap-2 h-10 font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded shadow"
                  aria-label="Message"
                >
                  Message
                  <Send size={18} className="ml-2" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="px-4">
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="likes">Liked</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>
          <TabsContent value="videos" className="mt-4">
            <div className="grid grid-cols-3 gap-2">
              {userVideos.map((video, idx) => (
                <Card
                  key={video.id}
                  className="relative aspect-[9/16] cursor-pointer group bg-black/10 overflow-hidden"
                  onClick={() => {
                    setCurrentVideoIndex(idx);
                    setShowVideoModal(true);
                  }}
                >
                  {/* Thumbnail image or fallback */}
                  {video.thumbnail_url ? (
                    <img
                      src={
                        video.thumbnail_url.startsWith('http')
                          ? video.thumbnail_url
                          : supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl
                      }
                      alt={video.title}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">
                      No Cover
                    </div>
                  )}
                  {/* 3-dots menu - Only show for own videos */}
                  {isOwnProfile && (
                    <div className="absolute top-2 right-2 z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteVideo(video.id, video.video_url, video.thumbnail_url);
                        }}
                      >
                        <MoreVertical size={18} />
                      </Button>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                      {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '0:00'}
                    </Badge>
                  </div>


                </Card>
              ))}
            </div>
            {userVideos.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {isOwnProfile ? 'No videos yet' : 'No videos posted yet'}
                </p>
                {isOwnProfile && (
                  <Button variant="neon" onClick={() => navigate('/upload')}>
                    Create Your First Video
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="likes" className="mt-4">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Your liked videos will appear here</p>
            </div>
          </TabsContent>
          <TabsContent value="saved" className="mt-4">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Your saved videos will appear here</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {showVideoModal && currentVideoIndex !== null && (
  <ModalVerticalFeed
    videos={userVideos}
    startIndex={currentVideoIndex}
    onClose={() => setShowVideoModal(false)}
  />
)}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
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

      {/* Bottom Navigation */}
      <BottomNavigation />
      <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} refreshKey={refreshKey} />
    </div>
  );
};

export default Profile;