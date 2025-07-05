import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import { MoreVertical } from "lucide-react";

const Profile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userVideos, setUserVideos] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserVideos();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user videos from the new videos table only (all assets in limeytt-uploads)
  const fetchUserVideos = async () => {
    if (!user?.id) return;
    try {
      const { data: dbVideos, error: dbError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setUserVideos(dbVideos || []);
    } catch (err) {
      console.error('Error fetching user videos:', err);
      setUserVideos([]);
    }
  };

  const handleDeleteVideo = async (videoId: string, videoUrl: string, thumbnailUrl?: string) => {
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
    fetchUserVideos();
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Profile</h1>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">Settings</Button>
            <Button variant="outline" size="sm" onClick={signOut}>Logout</Button>
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
                {profile?.username?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
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
            {profile?.display_name || user?.email}
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

          {/* Trini Credits */}
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-sm text-muted-foreground">TriniCredits:</span>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              💰 {profile?.trini_credits || 0}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => window.location.href = '/edit-profile'}>
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
                  className="relative aspect-[9/16] cursor-pointer group"
                  onClick={() => {
                    // TODO: Open video player modal here
                  }}
                >
                  {video.thumbnail_url ? (
                    <img
                      src={`https://<YOUR_SUPABASE_PROJECT_ID>.supabase.co/storage/v1/object/public/limeytt-uploads/${video.thumbnail_url}`}
                      alt={video.title}
                      className="w-full h-full object-cover rounded-lg group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full object-cover rounded-lg group-hover:opacity-80 transition-opacity bg-black/10 flex items-center justify-center">
                      {/* No cover image, just a background */}
                    </div>
                  )}
                  {/* 3-dots menu */}
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
                  <div className="absolute bottom-10 left-2 right-2">
                    <div className="text-white text-xs font-semibold truncate">
                      {video.title}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {userVideos.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No videos yet</p>
                <Button variant="neon" onClick={() => window.location.href = '/upload'}>
                  Create Your First Video
                </Button>
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