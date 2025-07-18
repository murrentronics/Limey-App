import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Search as SearchIcon, X as CloseIcon, Heart, MessageCircle, Share2, Play, Volume2, VolumeX, Plus, Pause, MessageSquare, TrendingUp, Users } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// --- AutoPlayVideo component ---
const AutoPlayVideo = ({ src, className, globalMuted, ...props }) => {
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = globalMuted;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          setIsVisible(true);
          video.play();
        } else {
          setIsVisible(false);
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => {
      observer.unobserve(video);
    };
  }, [globalMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted;
    }
  }, [globalMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={src}
        loop
        muted={globalMuted}
        playsInline
        className={className}
        {...props}
      />
      {/* Center Play Button - Only show when paused */}
      {isVisible && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Button
            variant="ghost"
            className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            data-control
          >
            <Play size={32} className="ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

const Friends = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({});
  const [isMuted, setIsMuted] = useState<{ [key: string]: boolean }>({});
  const [isLiked, setIsLiked] = useState<{ [key: string]: boolean }>({});
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [globalMuted, setGlobalMuted] = useState(false); // Start unmuted (sound ON)
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Record video view (only for other users' videos)
  const recordVideoView = async (videoId: string, creatorId: string) => {
    if (!user || user.id === creatorId) return;
    try {
      const { error } = await supabase.rpc('record_video_view', {
        video_uuid: videoId
      });
      if (error) {
        console.error('Error recording video view:', error);
      }
    } catch (error) {
      console.error('Error recording video view:', error);
    }
  };

  useEffect(() => {
    console.log("Friends - fetching videos from followed users");
    fetchFriendsVideos();
  }, [user]);

  // Real-time subscriptions for likes and video updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to video_likes changes (for heart color)
    const likesChannel = supabase
      .channel('video-likes-friends')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_likes'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.user_id === user.id) {
            setIsLiked(prev => ({ ...prev, [payload.new.video_id]: true }));
          } else if (payload.eventType === 'DELETE' && payload.old.user_id === user.id) {
            setIsLiked(prev => ({ ...prev, [payload.old.video_id]: false }));
          }
        }
      )
      .subscribe();

    // Subscribe to videos table changes (for like counts)
    const videosChannel = supabase
      .channel('videos-friends')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setVideos(prev =>
              prev.map(video =>
                video.id === payload.new.id ? { ...video, like_count: payload.new.like_count } : video
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(videosChannel);
    };
  }, [user]);

  const fetchFriendsVideos = async () => {
    if (!user) return;
    
    console.log("Friends - fetchFriendsVideos called");
    try {
      setLoading(true);
      setError(null);
      
      // First get the list of users the current user is following
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError) {
        console.error('Error fetching follows:', followsError);
        setError('Failed to load followed users.');
        return;
      }

      if (!follows || follows.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

      const followingIds = follows.map(f => f.following_id);

      // Now get videos from these users
      const { data, error } = await supabase
        .from('videos')
        .select(`*`)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching friends videos:', error);
        setError('Failed to load videos from friends. Please try again.');
        return;
      }
      
      console.log('Friends videos fetched:', data);
      setVideos(data || []);
      await checkFollowStatus(data || []);
      await checkLikeStatus(data || []);
    } catch (error) {
      console.error('Error in fetchFriendsVideos:', error);
      setError('Failed to load videos from friends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoRef = (videoId: string, element: HTMLVideoElement | null) => {
    videoRefs.current[videoId] = element;
  };

  const togglePlay = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;
    
    if (!video.paused) {
      // Pause the video
      video.pause();
      setIsPlaying(prev => ({ ...prev, [videoId]: false }));
      console.log(`Manually paused video ${videoId}`);
    } else {
      // Pause ALL other videos first
      Object.keys(videoRefs.current).forEach(id => {
        if (id !== videoId && videoRefs.current[id]) {
          const otherVideo = videoRefs.current[id];
          if (!otherVideo.paused) {
            otherVideo.pause();
            otherVideo.currentTime = 0;
            console.log(`Paused video ${id} because ${videoId} was manually started`);
          }
        }
      });
      
      // Update state to pause all others
      setIsPlaying(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(id => {
          if (id !== videoId) {
            newState[id] = false;
          }
        });
        return newState;
      });
      
      // Play this video
      video.play().then(() => {
        setIsPlaying(prev => ({ ...prev, [videoId]: true }));
        console.log(`Manually started video ${videoId}`);
      }).catch(e => {
        console.log("Play error:", e);
      });
    }
  };

  const toggleGlobalMute = () => {
    const newMutedState = !globalMuted;
    setGlobalMuted(newMutedState);
    // Update all videos to match global mute state
    Object.keys(videoRefs.current).forEach(videoId => {
      const video = videoRefs.current[videoId];
      if (video) {
        video.muted = newMutedState;
      }
    });
  };

  const handleLike = async (videoId: string) => {
    if (!user) return;

    try {
      const { data: existingLike } = await supabase
        .from('video_likes')
        .select('*')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        await supabase
          .from('video_likes')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);

        setIsLiked(prev => ({ ...prev, [videoId]: false }));

        const currentVideo = videos.find(v => v.id === videoId);
        if (currentVideo) {
          const newLikeCount = Math.max((currentVideo.like_count || 0) - 1, 0);
          await supabase
            .from('videos')
            .update({ like_count: newLikeCount })
            .eq('id', videoId);

          setVideos(prev =>
            prev.map(video =>
              video.id === videoId ? { ...video, like_count: newLikeCount } : video
            )
          );
        }
      } else {
        await supabase
          .from('video_likes')
          .insert({
            video_id: videoId,
            user_id: user.id
          });

        setIsLiked(prev => ({ ...prev, [videoId]: true }));

        const currentVideo = videos.find(v => v.id === videoId);
        if (currentVideo) {
          const newLikeCount = (currentVideo.like_count || 0) + 1;
          await supabase
            .from('videos')
            .update({ like_count: newLikeCount })
            .eq('id', videoId);

          setVideos(prev =>
            prev.map(video =>
              video.id === videoId ? { ...video, like_count: newLikeCount } : video
            )
          );
        }
      }
    } catch (error) {
      console.error('Error updating like status:', error);
    }
  };

  const handleShare = async (video: any) => {
    const videoUrl = `${window.location.origin}/video/${video.id}`;
    try {
      await navigator.share({
        title: video.title,
        text: video.description,
        url: videoUrl
      });
    } catch (error) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(videoUrl);
    }
  };

  // Follow function
  const handleFollow = async (targetUserId: string, targetUsername: string) => {
    if (!user) return;
    try {
      const { data: existingFollow } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .single();

      if (existingFollow) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        setFollowStatus(prev => ({ ...prev, [targetUserId]: false }));
        // Remove videos from this user from the feed
        setVideos(prev => prev.filter(v => v.user_id !== targetUserId));
        return false; // now unfollowed
      } else {
        // Only insert if not already following
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });
        if (!error) {
          setFollowStatus(prev => ({ ...prev, [targetUserId]: true }));
          return true; // now following
        }
        // If error is 409 or duplicate, ignore
        if (error && error.code !== '23505' && error.status !== 409) {
          console.error('Error following:', error);
        }
        return false;
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      return followStatus[targetUserId] || false;
    }
  };

  const getUsername = (video: any) => {
    // Use direct username field from videos table
    if (video.username) return video.username;
    if (video.user_id) {
      const userId = video.user_id.replace(/[^a-zA-Z0-9]/g, "");
      return `user_${userId.slice(0, 8)}`;
    }
    return 'unknown_user';
  };

  const getProfileUrl = (video: any) => {
    const username = getUsername(video);
    if (user && video.user_id === user.id) {
      return '/profile';
    }
    return `/profile/${username}`;
  };

  const checkFollowStatus = async (videosArr: any[]) => {
    if (!user) return;
    try {
      const userIds = videosArr.map(video => video.user_id).filter(id => id !== user.id);
      if (userIds.length === 0) return;
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', userIds);
      const followingSet = new Set(follows?.map(f => f.following_id) || []);
      const newFollowStatus: { [key: string]: boolean } = {};
      videosArr.forEach(video => {
        if (video.user_id !== user.id) {
          newFollowStatus[video.user_id] = followingSet.has(video.user_id);
        }
      });
      setFollowStatus(prev => ({ ...prev, ...newFollowStatus }));
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  // Check like status for all videos
  const checkLikeStatus = async (videosArr: any[]) => {
    if (!user) return;
    try {
      const videoIds = videosArr.map(video => video.id);
      if (videoIds.length === 0) return;
      
      const { data: likes } = await supabase
        .from('video_likes')
        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds);
      
      const likedVideoIds = new Set(likes?.map(like => like.video_id) || []);
      const newLikeStatus: { [key: string]: boolean } = {};
      videosArr.forEach(video => {
        newLikeStatus[video.id] = likedVideoIds.has(video.id);
      });
      setIsLiked(prev => ({ ...prev, ...newLikeStatus }));
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-2">
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
            Friends
          </span>
          <div className="flex items-center space-x-2">
            {/* Trending Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/trending')}
              className="text-white hover:bg-white/10"
              aria-label="Trending"
            >
              <TrendingUp size={20} />
            </Button>
            {/* Live Button */}
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
            {/* Settings Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="text-white hover:bg-white/10"
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Global Mute Toggle */}
      <div className="fixed top-20 right-4 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setGlobalMuted((m) => !m)}
          aria-label="Toggle Global Mute"
          className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
        >
          {globalMuted ? (
            <VolumeX size={24} className="text-white" />
          ) : (
            <Volume2 size={24} className="text-white" />
          )}
        </Button>
      </div>

      {/* Video Feed */}
      <div
        ref={containerRef}
        className="pt-20 pb-24 h-screen overflow-y-auto snap-y snap-mandatory"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* Loading/Error */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={fetchFriendsVideos} variant="outline" className="text-white border-white/20 hover:bg-white/10">
              Try Again
            </Button>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">No videos from friends</h3>
            <p className="text-white/70 mb-4">
              Follow some users to see their videos here, or your friends haven't posted any videos yet.
            </p>
            <Button
              onClick={() => navigate('/')}
              variant="default"
              className="bg-white text-black hover:bg-white/90"
            >
              Discover People to Follow
            </Button>
          </div>
        ) : (
          <div className="space-y-0">
            {videos.map((video) => (
              <div
                key={video.id}
                data-video-id={video.id}
                className="relative h-screen snap-start snap-always flex items-center justify-center"
                onClick={e => {
                  // Only trigger play/pause if not clicking on a control
                  const controlSelectors = ['button[data-control]'];
                  let el = e.target as HTMLElement;
                  while (el && el !== e.currentTarget) {
                    if (controlSelectors.some(sel => el.matches(sel))) {
                      return;
                    }
                    el = el.parentElement;
                  }
                  // Find the video element and toggle play/pause
                  const videoElement = e.currentTarget.querySelector('video');
                  if (videoElement) {
                    if (videoElement.paused) {
                      videoElement.play();
                    } else {
                      videoElement.pause();
                    }
                  }
                }}
              >
                {/* Video */}
                <AutoPlayVideo
                  src={video.video_url}
                  className="w-full h-full object-cover"
                  globalMuted={globalMuted}
                />

                {/* Overlay UI */}
                <div className="absolute bottom-20 left-0 right-0 p-6 text-white">
                  <div className="flex justify-between items-end">
                    {/* Left - User info & caption */}
                    <div className="flex-1 mr-4 space-y-3">
                      {/* User Profile */}
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={video.avatar_url || undefined} alt={getUsername(video)} />
                            <AvatarFallback>{getUsername(video).charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {/* Follow Button */}
                          {user && video.user_id !== user.id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleFollow(video.user_id, getUsername(video));
                              }}
                              className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:bg-green-700 transition-colors"
                              data-control
                            >
                              {followStatus[video.user_id] ? (
                                <span className="text-white font-bold text-sm">✓</span>
                              ) : (
                                <Plus size={12} className="text-white" />
                              )}
                            </button>
                          )}
                        </div>
                        <div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(getProfileUrl(video));
                            }}
                            className="text-white font-semibold text-lg hover:text-white/80 transition-colors"
                          >
                            @{getUsername(video)}
                          </button>
                        </div>
                      </div>

                      {/* Caption */}
                      <div className="space-y-2">
                        <h3 className="text-white font-semibold text-base leading-tight">{video.title}</h3>
                        {video.description && (
                          <p className="text-white/90 text-sm leading-relaxed">{video.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center space-y-6">
                      {/* Like */}
                      <div className="flex flex-col items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(video.id);
                          }}
                          className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
                          data-control
                        >
                          <Heart
                            size={24}
                            className={`${
                              isLiked[video.id] ? "fill-red-500 text-red-500" : "text-white"
                            }`}
                          />
                        </Button>
                        <span className="text-white text-xs font-semibold mt-1">{video.like_count || 0}</span>
                      </div>
                      {/* Comment */}
                      <div className="flex flex-col items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
                          data-control
                        >
                          <MessageCircle size={24} className="text-white" />
                        </Button>
                        <span className="text-white text-xs font-semibold mt-1">{video.comment_count || 0}</span>
                      </div>
                      {/* Share */}
                      <div className="flex flex-col items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(video);
                          }}
                          className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
                          data-control
                        >
                          <Share2 size={24} className="text-white" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Friends;