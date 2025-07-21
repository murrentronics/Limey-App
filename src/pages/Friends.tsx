import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, MessageCircle, Share2, Play, Volume2, VolumeX, TrendingUp, Users } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// --- AutoPlayVideo component ---
const AutoPlayVideo = ({ src, className, globalMuted, ...props }: { src: string; className: string; globalMuted: boolean;[key: string]: any }) => {
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


  const [globalMuted, setGlobalMuted] = useState(false); // Start unmuted (sound ON)

  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();



  useEffect(() => {
    console.log("Friends - fetching videos from followed users");
    fetchFriendsVideos();
  }, [user]);



  const fetchFriendsVideos = async () => {
    if (!user) return;

    console.log("Friends - fetchFriendsVideos called");
    try {
      setLoading(true);
      setError(null);

      // Get all videos since we're removing follow functionality
      const { data, error } = await supabase
        .from('videos')
        .select(`*, profiles!inner(username, avatar_url, deactivated)`) // include deactivated
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching videos:', error);
        setError('Failed to load videos. Please try again.');
        return;
      }

      console.log('Videos fetched:', data);
      const filtered = (data || []).filter(v => !v.profiles?.deactivated);
      setVideos(filtered);
    } catch (error) {
      console.error('Error in fetchFriendsVideos:', error);
      setError('Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
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
            <h3 className="text-lg font-semibold mb-2 text-white">No videos available</h3>
            <p className="text-white/70 mb-4">
              No videos have been posted yet.
            </p>
            <Button
              onClick={() => navigate('/')}
              variant="default"
              className="bg-white text-black hover:bg-white/90"
            >
              Discover Videos
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