import { useNavigate } from "react-router-dom";
import ModalVerticalFeed from "@/components/ModalVerticalFeed";
import AutoPlayVideo from "@/components/AutoPlayVideo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import BottomNavigation from "@/components/BottomNavigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings, TrendingUp, Eye, Trophy, Medal, Award } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const Trending = () => {
  const navigate = useNavigate();

  // Add fire animation styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fire-glow {
        0%, 100% { 
          filter: drop-shadow(0 0 5px #ff6b35) drop-shadow(0 0 10px #ff8c42) drop-shadow(0 0 15px #ffa726);
          transform: rotate(-1deg) scale(1);
        }
        25% { 
          filter: drop-shadow(0 0 8px #ff5722) drop-shadow(0 0 15px #ff7043) drop-shadow(0 0 20px #ffab40);
          transform: rotate(1deg) scale(1.05);
        }
        50% { 
          filter: drop-shadow(0 0 6px #ff6b35) drop-shadow(0 0 12px #ff8c42) drop-shadow(0 0 18px #ffa726);
          transform: rotate(-0.5deg) scale(1.02);
        }
        75% { 
          filter: drop-shadow(0 0 9px #ff5722) drop-shadow(0 0 16px #ff7043) drop-shadow(0 0 22px #ffab40);
          transform: rotate(0.5deg) scale(1.03);
        }
      }
      
      .animate-fire {
        animation: fire-glow 2s ease-in-out infinite;
        display: inline-block;
        transform-origin: center bottom;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const VIDEOS_PER_PAGE = 25;



  // Function to fetch latest profile data for videos (including updated profile images)
  const fetchLatestProfileData = async (videosList: any[]) => {
    if (!videosList || videosList.length === 0) return;

    try {
      // Get unique user IDs from videos
      const userIds = [...new Set(videosList.map(video => video.user_id))];

      // Fetch latest profile data for these users
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      if (error) {
        console.error('Error fetching latest profile data:', error);
        return;
      }

      if (profilesData && profilesData.length > 0) {
        // Create a map of user_id to profile data
        const profilesMap = new Map();
        profilesData.forEach(p => profilesMap.set(p.user_id, p));

        // Update videos with latest profile data
        const updatedVideos = videosList.map(video => {
          const latestProfile = profilesMap.get(video.user_id);
          if (latestProfile) {
            return {
              ...video,
              profiles: {
                ...video.profiles,
                username: latestProfile.username,
                avatar_url: latestProfile.avatar_url
              },
              avatar_url: latestProfile.avatar_url
            };
          }
          return video;
        });

        // Update state with latest profile data
        setTrendingVideos(updatedVideos);
        console.log('Updated trending videos with latest profile data');
      }
    } catch (error) {
      console.error('Error in fetchLatestProfileData:', error);
    }
  };

  const fetchTrending = async () => {
    setLoading(true);

    try {
      console.log('Fetching trending videos...');

      // Fetch videos without joining profiles to avoid relationship issues
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select(`
          id, 
          title, 
          video_url, 
          thumbnail_url, 
          duration, 
          user_id, 
          created_at,
          view_count,
          like_count,
          share_count,
          save_count
        `)
        .order('view_count', { ascending: false, nullsFirst: false })
        .order('like_count', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(VIDEOS_PER_PAGE);

      console.log('Videos query result:', { videos, error: videosError });

      if (videosError) {
        console.error('Error fetching videos:', videosError);
        setLoading(false);
        return;
      }

      if (!videos || videos.length === 0) {
        console.log('No videos found in database');
        setTrendingVideos([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs from videos
      const userIds = [...new Set(videos.map(v => v.user_id))];

      // Fetch profile data separately
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of profiles for easy lookup
      const profilesMap = new Map();
      (profiles || []).forEach(p => profilesMap.set(p.user_id, p));

      // Get genuine view counts using the same RPC function as Feed
      const viewCountsMap = new Map();
      for (const video of videos) {
        try {
          const { data: genuineCount, error } = await supabase.rpc('get_genuine_view_count', {
            video_uuid: video.id
          });

          if (!error && typeof genuineCount === 'number') {
            viewCountsMap.set(video.id, genuineCount);
          } else {
            // Fallback to the view_count from the video record
            viewCountsMap.set(video.id, video.view_count || 0);
          }
        } catch (err) {
          console.error(`Error getting view count for video ${video.id}:`, err);
          viewCountsMap.set(video.id, video.view_count || 0);
        }
      }

      // Combine videos with profile data and actual view counts
      const videosWithProfiles = videos.map(video => {
        const profile = profilesMap.get(video.user_id);
        return {
          ...video,
          profiles: profile ? {
            username: profile.username,
            avatar_url: profile.avatar_url,
            user_id: profile.user_id
          } : null,
          actual_view_count: viewCountsMap.get(video.id) || 0,
          genuine_view_count: viewCountsMap.get(video.id) || 0
        };
      });

      // Use all videos with profiles
      const filteredVideos = videosWithProfiles.filter(v => v.profiles);
      console.log('Filtered videos with profiles:', filteredVideos.length);

      // Sort by actual views first, then likes, then creation date
      const sortedVideos = filteredVideos.sort((a, b) => {
        // Sort by genuine views first (descending), then by likes (descending)
        const aViews = a.genuine_view_count || 0;
        const bViews = b.genuine_view_count || 0;
        const aLikes = a.like_count || 0;
        const bLikes = b.like_count || 0;

        if (bViews !== aViews) {
          return bViews - aViews;
        }
        if (bLikes !== aLikes) {
          return bLikes - aLikes;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      console.log('Sorted trending videos:', sortedVideos.length);
      console.log('Sample video with profile:', sortedVideos[0]);

      setTrendingVideos(sortedVideos);

      // Fetch latest profile data
      await fetchLatestProfileData(sortedVideos);
    } catch (err) {
      console.error('Error in fetchTrending:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  // Real-time subscriptions for profile and like updates
  useEffect(() => {
    if (!user) return;

    console.log('Setting up real-time subscriptions for trending page');

    // Subscribe to video changes (for like counts)
    const videosChannel = supabase
      .channel('trending_videos_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos'
      }, async (payload) => {
        console.log('Trending: Video change detected via real-time:', payload);

        if (payload.new && payload.old) {
          const videoId = payload.new.id;
          const newLikeCount = payload.new.like_count || 0;

          console.log(`Trending: Like count for video ${videoId}: ${payload.old.like_count} -> ${newLikeCount}`);

          // Update the like count in trending videos array
          setTrendingVideos(prev => prev.map(video =>
            video.id === videoId
              ? { ...video, like_count: newLikeCount }
              : video
          ));
        }
      })
      .subscribe();

    // Subscribe to video_likes table for direct like status updates
    const likesChannel = supabase
      .channel('trending_likes_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_likes'
      }, async (payload) => {
        console.log('Trending: Like change detected:', payload);

        // Like status changes handled by modal component
      })
      .subscribe();

    // Subscribe to profile changes
    const profilesChannel = supabase
      .channel('trending_profiles_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles'
      }, async (payload) => {
        console.log('Trending: Profile change detected:', payload);

        if (payload.new) {
          await fetchLatestProfileData(trendingVideos);
        }
      })
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions for trending page');
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [user, trendingVideos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-white">Loading trending videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="animate-fire">🔥</span>
            Trending
          </h1>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/live')}
              className="text-white hover:bg-white/10"
              aria-label="Live"
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">LIVE</span>
              </div>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} aria-label="Settings">
              <Settings size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="px-4 py-6 text-center">
        <h2 className="text-xl font-semibold text-white flex items-center justify-center gap-2 mb-2">
          <TrendingUp size={22} className="text-orange-500" />
          Most Trending Videos Today
        </h2>
        <p className="text-sm text-gray-400">Ranked by views and engagement</p>
      </div>

      {/* Trending Videos */}
      <div className="grid grid-cols-3 gap-2 p-4">
        {trendingVideos.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <TrendingUp size={48} className="text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No trending videos found</p>
            <p className="text-gray-500 text-sm">Check back later for the latest trending content!</p>
          </div>
        ) : (
          trendingVideos.map((video, index) => (
            <Card
              key={video.id}
              className="relative aspect-[9/16] cursor-pointer group overflow-hidden bg-black/10"
              onClick={() => {
                setModalIndex(index);
                setShowModal(true);
              }}
            >
              {/* Top trending badge for top 3 */}
              {index < 3 && (
                <div className="absolute top-2 right-2 z-20">
                  {index === 0 && (
                    <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full px-2 py-1 shadow-lg">
                      <Trophy size={12} className="text-white" />
                      <span className="text-xs font-bold text-white">#1</span>
                    </div>
                  )}
                  {index === 1 && (
                    <div className="flex items-center gap-1 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full px-2 py-1 shadow-lg">
                      <Medal size={12} className="text-white" />
                      <span className="text-xs font-bold text-white">#2</span>
                    </div>
                  )}
                  {index === 2 && (
                    <div className="flex items-center gap-1 bg-gradient-to-r from-amber-600 to-amber-700 rounded-full px-2 py-1 shadow-lg">
                      <Award size={12} className="text-white" />
                      <span className="text-xs font-bold text-white">#3</span>
                    </div>
                  )}
                </div>
              )}

              {/* Top left: Creator avatar */}
              <div className="absolute top-2 left-2 z-10">
                <Avatar className="w-8 h-8 border-2 border-white shadow">
                  <AvatarImage src={video.profiles?.avatar_url || undefined} alt={video.profiles?.username || video.user_id} />
                  <AvatarFallback>{(video.profiles?.username || video.user_id)?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>

              {/* Video thumbnail or video preview */}
              <div className="w-full h-full">
                <AutoPlayVideo
                  src={video.video_url}
                  className="w-full h-full object-cover"
                  globalMuted={true}
                />
              </div>

              {/* Bottom stats overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Eye size={12} />
                      <span>{video.genuine_view_count >= 1000 ? `${(video.genuine_view_count / 1000).toFixed(1)}K` : video.genuine_view_count || 0}</span>
                    </div>
                  </div>
                  {video.duration && (
                    <div className="bg-black/60 rounded-full px-2 py-1">
                      {`${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {showModal && modalIndex !== null && (
        <ModalVerticalFeed
          videos={trendingVideos}
          startIndex={modalIndex}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Trending;