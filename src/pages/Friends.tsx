import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, MessageCircle, Share2, Play, Volume2, VolumeX, TrendingUp, Users, Plus, Heart, Eye, Bookmark } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import ShareModal from "@/components/ShareModal";

// --- AutoPlayVideo component ---
const AutoPlayVideo = ({ src, className, globalMuted, ...props }: { src: string; className: string; globalMuted: boolean;[key: string]: any }) => {
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Wake Lock API to prevent screen from sleeping
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.error('Failed to request wake lock:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  };

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

    const onPlay = () => {
      setIsPlaying(true);
      requestWakeLock(); // Prevent screen sleep when video plays
    };

    const onPause = () => {
      setIsPlaying(false);
      releaseWakeLock(); // Allow screen sleep when video pauses
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      releaseWakeLock(); // Clean up wake lock on unmount
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
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({});
  const [likeStatus, setLikeStatus] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [globalMuted, setGlobalMuted] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareVideo, setShareVideo] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Add fire animation CSS
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



  useEffect(() => {
    fetchFriendsVideos();
  }, [user]);



  const fetchFriendsVideos = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      // First, get the list of users that the current user is following
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError) {
        console.error('Error fetching follows:', followsError);
        setError('Failed to load videos. Please try again.');
        return;
      }

      if (!follows || follows.length === 0) {
        setVideos([]);
        return;
      }

      const followingUserIds = follows.map(f => f.following_id);

      // Fetch videos only from users that the current user is following
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select(`
          id, 
          title, 
          description,
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
        .in('user_id', followingUserIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (videosError) {
        console.error('Error fetching videos:', videosError);
        setError('Failed to load videos. Please try again.');
        return;
      }

      if (!videos || videos.length === 0) {
        setVideos([]);
        return;
      }

      // Get unique user IDs from videos
      const userIds = [...new Set(videos.map(v => v.user_id))];

      // Fetch profile data separately
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, deactivated')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of profiles for easy lookup
      const profilesMap = new Map();
      (profiles || []).forEach(p => profilesMap.set(p.user_id, p));

      // Combine videos with profile data
      const videosWithProfiles = videos.map(video => {
        const profile = profilesMap.get(video.user_id);
        return {
          ...video,
          profiles: profile ? {
            username: profile.username,
            avatar_url: profile.avatar_url,
            deactivated: profile.deactivated,
            user_id: profile.user_id
          } : null,
          avatar_url: profile?.avatar_url
        };
      });

      // Filter out videos from deactivated profiles
      const filteredVideos = videosWithProfiles.filter(v => v.profiles && !v.profiles.deactivated);

      // Initialize counts from the fetched data
      const initialLikeCounts = {};
      const initialShareCounts = {};
      const initialSaveCounts = {};
      const initialViewCounts = {};
      filteredVideos.forEach(video => {
        initialLikeCounts[video.id] = video.like_count || 0;
        initialShareCounts[video.id] = video.share_count || 0;
        initialSaveCounts[video.id] = video.save_count || 0;
        initialViewCounts[video.id] = video.view_count || 0;
      });

      // Update counts immediately
      setLikeCounts(prev => ({ ...prev, ...initialLikeCounts }));
      setShareCounts(prev => ({ ...prev, ...initialShareCounts }));
      setSaveCounts(prev => ({ ...prev, ...initialSaveCounts }));
      setViewCounts(prev => ({ ...prev, ...initialViewCounts }));

      setVideos(filteredVideos);
      await checkFollowStatus(filteredVideos);
      await checkLikeStatus(filteredVideos);
      await checkViewCounts(filteredVideos);
      await checkSavedStatus(filteredVideos);
    } catch (error) {
      console.error('Error in fetchFriendsVideos:', error);
      setError('Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const checkLikeStatus = async (videosArr: any[]) => {
    if (!user) return;
    try {
      const videoIds = videosArr.map(video => video.id);
      if (videoIds.length === 0) return;

      const likedVideoIds = new Set<string>();
      const batchSize = 5;
      for (let i = 0; i < videoIds.length; i += batchSize) {
        const batch = videoIds.slice(i, i + batchSize);
        await Promise.all(batch.map(async (videoId) => {
          try {
            const { data, error } = await supabase
              .from('video_likes')
              .select('id')
              .eq('video_id', videoId)
              .eq('user_id', user.id);
            if (!error && data && data.length > 0) {
              likedVideoIds.add(videoId);
            }
          } catch (err) {
            console.error(`Error checking like for video ${videoId}:`, err);
          }
        }));
      }

      const newLikeStatus: { [key: string]: boolean } = {};
      videosArr.forEach(video => {
        newLikeStatus[video.id] = likedVideoIds.has(video.id);
      });
      setLikeStatus(prev => ({ ...prev, ...newLikeStatus }));
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const checkViewCounts = async (videosArr: any[]) => {
    try {
      const newViewCounts: { [key: string]: number } = {};

      // Get genuine view counts from the database function
      for (const video of videosArr) {
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

  const checkSavedStatus = async (videosArr: any[]) => {
    if (!user || videosArr.length === 0) return;
    try {
      const videoIds = videosArr.map(video => video.id);
      const response = await (supabase as any)
        .from('saved_videos')
        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds);
      const saved = response.data || [];
      const savedVideoIds = new Set<string>(saved.map(row => row.video_id));
      const newSavedStatus: Record<string, boolean> = {};
      videosArr.forEach(video => {
        if (video && video.id) {
          newSavedStatus[video.id] = savedVideoIds.has(video.id);
        }
      });
      setSavedStatus(newSavedStatus);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

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
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        setFollowStatus(prev => ({ ...prev, [targetUserId]: false }));
        return false;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });
        if (!error) {
          setFollowStatus(prev => ({ ...prev, [targetUserId]: true }));
          return true;
        }
        if (error && error.code !== '23505') {
          console.error('Error following:', error);
        }
        return false;
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      return followStatus[targetUserId] || false;
    }
  };

  const handleLike = async (videoId: string) => {
    if (!user) return;
    try {
      const currentLikeStatus = likeStatus[videoId] || false;
      const currentLikeCount = likeCounts[videoId] || 0;

      setLikeStatus(prev => ({
        ...prev,
        [videoId]: !currentLikeStatus
      }));

      setLikeCounts(prev => ({
        ...prev,
        [videoId]: currentLikeStatus ? Math.max(0, currentLikeCount - 1) : currentLikeCount + 1
      }));

      const { data, error } = await supabase.rpc('toggle_video_like' as any, {
        video_uuid: videoId
      });

      if (error) {
        console.error('Error toggling like:', error);
        setLikeStatus(prev => ({
          ...prev,
          [videoId]: currentLikeStatus
        }));
        setLikeCounts(prev => ({
          ...prev,
          [videoId]: currentLikeCount
        }));
        return;
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleSave = async (videoId: string) => {
    if (!user) return;
    try {
      if (savedStatus[videoId]) {
        const { error: deleteError } = await (supabase as any)
          .from('saved_videos')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
        if (deleteError) throw deleteError;
        setSavedStatus(prev => ({ ...prev, [videoId]: false }));
        setSaveCounts(prev => ({
          ...prev,
          [videoId]: Math.max((prev[videoId] || 0) - 1, 0)
        }));
      } else {
        const { error: insertError } = await (supabase as any)
          .from('saved_videos')
          .insert({
            user_id: user.id,
            video_id: videoId
          });
        if (insertError) throw insertError;
        setSavedStatus(prev => ({ ...prev, [videoId]: true }));
        setSaveCounts(prev => ({
          ...prev,
          [videoId]: (prev[videoId] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Error saving/unsaving video:', error);
      setSavedStatus(prev => ({ ...prev, [videoId]: !prev[videoId] }));
    }
  };

  const handleShare = async (video: any) => {
    try {
      const { error } = await supabase
        .from('videos')
        .update({
          share_count: (video.share_count || 0) + 1
        })
        .eq('id', video.id);

      if (!error) {
        setShareCounts(prev => ({
          ...prev,
          [video.id]: (prev[video.id] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Error incrementing share count:', error);
    }

    setShareVideo(video);
    setShareModalOpen(true);
  };

  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  const getUsername = (video: any) => {
    if (video.profiles?.username) return video.profiles.username;
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

  const renderDescriptionWithHashtags = (description: string) => {
    return description.split(/(#[\w-]+)/g).map((part, idx) => {
      if (/^#[\w-]+$/.test(part)) {
        return (
          <button
            key={idx}
            className="text-lime-400 hover:underline font-semibold"
            onClick={e => {
              e.stopPropagation();
              // Could implement hashtag filtering here
            }}
          >
            {part}
          </button>
        );
      }
      return part;
    });
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
              <span className="animate-fire text-xl">🔥</span>
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
        className="h-screen overflow-y-auto snap-y snap-mandatory"
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
                  const controlSelectors = ['button[data-control]'];
                  let el = e.target as HTMLElement;
                  while (el && el !== e.currentTarget) {
                    if (controlSelectors.some(sel => el.matches(sel))) {
                      return;
                    }
                    el = el.parentElement;
                  }
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
                {/* Black space for top menu */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-black z-10"></div>

                {/* Video container with fixed height - stops above the text area */}
                <div className="absolute inset-0 top-16 bottom-32 overflow-hidden">
                  <AutoPlayVideo
                    src={video.video_url}
                    className="w-full h-full object-cover"
                    globalMuted={globalMuted}
                  />
                </div>

                {/* Separator line */}
                <div className="absolute bottom-32 left-0 right-0 h-[1px] bg-white/20 z-10"></div>

                {/* Text area with black background */}
                <div className="absolute bottom-16 left-0 right-0 h-16 bg-black z-10"></div>

                {/* Black space for bottom navigation */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-black z-10"></div>

                {/* Video Info Overlay - positioned in the text area */}
                <div className="absolute bottom-16 left-0 right-0 p-4 text-white z-20">
                  <div className="flex justify-between items-end">
                    {/* Left - User info & caption */}
                    <div className="flex-1 mr-4 space-y-3">
                      {/* Caption */}
                      <div className="space-y-2">
                        <h3 className="text-white font-semibold text-base leading-tight">{video.title}</h3>
                        {video.description && (
                          <p className="text-white/90 text-sm leading-relaxed">
                            {renderDescriptionWithHashtags(video.description)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex flex-col items-center space-y-6">
                      {/* Profile Button */}
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(getProfileUrl(video));
                            }}
                            className="hover:opacity-80 transition-opacity"
                            aria-label={`View ${getUsername(video)}'s profile`}
                            data-control
                          >
                            <Avatar className="w-12 h-12 rounded-full">
                              <AvatarImage src={video.avatar_url || undefined} alt={getUsername(video)} />
                              <AvatarFallback>{getUsername(video).charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </button>
                          {/* Follow Button */}
                          {user && video.user_id !== user.id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleFollow(video.user_id, getUsername(video));
                              }}
                              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors"
                              data-control
                            >
                              {followStatus[video.user_id] ? (
                                <span className="text-white font-bold text-sm">✓</span>
                              ) : (
                                <Plus size={14} className="text-white" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Like Button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(video.id);
                          }}
                          className="p-0 bg-transparent border-none"
                          data-control
                        >
                          <Heart
                            size={28}
                            className={`${likeStatus[video.id] ? 'text-red-500 fill-red-500' : 'text-white fill-white'} transition-colors`}
                          />
                        </button>
                        <span className="text-white text-xs mt-1 font-medium">
                          {likeCounts[video.id] || 0}
                        </span>
                      </div>

                      {/* View Count */}
                      <div className="flex flex-col items-center">
                        <Eye size={28} className="text-white" />
                        <span className="text-white text-xs mt-1 font-medium">
                          {formatViews(viewCounts[video.id] || 0)}
                        </span>
                      </div>

                      {/* Save Button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={e => { e.stopPropagation(); handleSave(video.id); }}
                          className="p-0 bg-transparent border-none"
                          data-control
                        >
                          <Bookmark
                            size={28}
                            className={`${savedStatus[video.id] ? 'text-yellow-500 fill-yellow-500' : 'text-white fill-white'} transition-colors`}
                          />
                        </button>
                        <span className="text-white text-xs mt-1 font-medium">
                          {saveCounts[video.id] || 0}
                        </span>
                      </div>

                      {/* Share */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(video);
                          }}
                          className="p-0 bg-transparent border-none"
                          data-control
                        >
                          <Share2 size={28} className="text-white fill-white" />
                        </button>
                        <span className="text-white text-xs mt-1 font-medium">
                          {shareCounts[video.id] || 0}
                        </span>
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

      {/* Share Modal */}
      {shareVideo && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setShareVideo(null);
          }}
          video={shareVideo}
        />
      )}
    </div>
  );
};

export default Friends;