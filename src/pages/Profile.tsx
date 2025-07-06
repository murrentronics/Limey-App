import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import { MoreVertical } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username, user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      let targetUserId = user?.id;
      let targetUsername = username;
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
            targetUsername = profileById.username;
            // Check if this is the current user's profile
            isOwn = profileById.user_id === user?.id;
          }
        } else {
          setProfile(profileByUsername);
          targetUserId = profileByUsername.user_id;
          targetUsername = profileByUsername.username;
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

  const handleDeleteVideo = async (videoId: string, videoUrl: string, thumbnailUrl?: string) => {
    if (!isOwnProfile) {
      alert("You can only delete your own videos.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to delete this video? This cannot be undone.")) return;
    
    // Remove from DB
    const { error: dbError } = await supabase.from('videos').delete().eq('id', videoId);
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
            <h1 className="text-2xl font-bold text-primary">Profile Not Found</h1>
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
          {!isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              ← Back
            </Button>
          )}
          <h1 className="text-2xl font-bold text-primary">
            {isOwnProfile ? 'Profile' : `@${profile.username}`}
          </h1>
          <div className="flex items-center space-x-2">
            {isOwnProfile ? (
              <>
                <Button variant="ghost" size="sm">Settings</Button>
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
            {showViewModal && profile?.avatar_url && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowViewModal(false)}>
                <button className="absolute top-4 right-4 text-white text-2xl bg-black/60 rounded-full px-3 py-1" onClick={e => { e.stopPropagation(); setShowViewModal(false); }}>&times;</button>
                <img src={profile.avatar_url} alt="Profile" className="max-w-xs max-h-[80vh] rounded-lg border-2 border-primary bg-white" onClick={e => e.stopPropagation()} />
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
              <div className="text-xl font-bold text-foreground">{profile?.following_count || 0}</div>
              <div className="text-xs text-muted-foreground">Following</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{profile?.follower_count || 0}</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
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

          {/* Trini Credits - Only show for own profile */}
          {isOwnProfile && (
            <div className="flex items-center space-x-2 mb-6">
              <span className="text-sm text-muted-foreground">TriniCredits:</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                💰 {profile?.trini_credits || 0}
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
                    const url = `${window.location.origin}/profile/${profile?.username || user?.id}`;
                    if (navigator.share) {
                      navigator.share({
                        title: `Check out @${profile?.username || 'user'} on Limey!`,
                        url
                      });
                    } else {
                      navigator.clipboard.writeText(url);
                      alert('Profile link copied to clipboard!');
                    }
                  }}
                >
                  Share Profile
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline">
                  Follow
                </Button>
                <Button 
                  variant="neon"
                  onClick={() => {
                    const url = `${window.location.origin}/profile/${profile?.username}`;
                    if (navigator.share) {
                      navigator.share({
                        title: `Check out @${profile?.username} on Limey!`,
                        url
                      });
                    } else {
                      navigator.clipboard.writeText(url);
                      alert('Profile link copied to clipboard!');
                    }
                  }}
                >
                  Share Profile
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
              {userVideos.map((video) => (
                <Card
                  key={video.id}
                  className="relative aspect-[9/16] cursor-pointer group bg-black/10"
                  onClick={() => {
                    // TODO: Open video player modal here
                  }}
                >
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
                  <div className="absolute bottom-2 left-2">
                    <div className="text-white text-xs">
                      👁️ {video.view_count || 0}
                    </div>
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

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Profile;