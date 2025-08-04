import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX, Share, Play, Plus, Heart, Eye, Bookmark, BookmarkCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ShareModal from "@/components/ShareModal";

interface Video {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  user_id: string;
  created_at: string;
  like_count?: number;
  view_count?: number;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

interface VideoPlayerProps {
  video: Video;
  videos: Video[];
  setVideos: React.Dispatch<React.SetStateAction<any[]>>;
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

// ...existing code...
const VideoPlayer = ({ video, videos, setVideos, currentIndex, onClose, onNext, onPrevious }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [likeStatus, setLikeStatus] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const [viewCounts, setViewCounts] = useState<{ [key: string]: number }>({});
  const [viewRecorded, setViewRecorded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [savedStatus, setSavedStatus] = useState<{ [key: string]: boolean }>({});
  const [latestProfileData, setLatestProfileData] = useState<{ username?: string; avatar_url?: string } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();


  // Restore handleShare function
  const handleShare = () => {
    setShareModalOpen(true);
  };





  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diffY = touchStartY - endY;

    // Swipe threshold
    if (Math.abs(diffY) > 50) {
      if (diffY > 0 && currentIndex < videos.length - 1) {
        // Swipe up - next video
        onNext();
      } else if (diffY < 0 && currentIndex > 0) {
        // Swipe down - previous video
        onPrevious();
      }
    }
  };



  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
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

  const checkFollowStatus = async () => {
    if (!user) return;
    try {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('following_id', video.user_id);
      setFollowStatus(prev => ({ ...prev, [video.user_id]: !!follows }));
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  // Like handling functions
  const handleLike = async (videoId: string) => {
    if (!user) return;

    try {
      // Call the toggle_video_like function
      const { data, error } = await supabase.rpc('toggle_video_like' as any, {
        video_uuid: videoId
      });

      if (error) {
        console.error('Error toggling like:', error);
        return;
      }

      // Update local state
      const isNowLiked = data; // Function returns true if now liked, false if unliked
      setLikeStatus(prev => ({ ...prev, [videoId]: isNowLiked }));

      // Update like count
      setLikeCounts(prev => ({
        ...prev,
        [videoId]: isNowLiked
          ? (prev[videoId] || 0) + 1
          : Math.max((prev[videoId] || 0) - 1, 0)
      }));

    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const checkLikeStatus = async () => {
    if (!user) return;

    try {
      // Check if user has liked this video
      const { data: likes } = await supabase
        .from('video_likes')
        .select('video_id')
        .eq('user_id', user.id)
        .eq('video_id', video.id);

      const isLiked = likes && likes.length > 0;
      console.log('VideoPlayer like status check:', { videoId: video.id, isLiked, likesData: likes, likeCount: video.like_count });

      setLikeStatus(prev => ({ ...prev, [video.id]: isLiked }));

      // Get current like count from video data or fetch it
      setLikeCounts(prev => ({ ...prev, [video.id]: video.like_count || 0 }));

    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  // View handling functions
  const recordView = async () => {
    if (viewRecorded) return;

    // Check if the current user is the creator of the video
    // If so, don't record the view (prevent self-views)
    if (user && video.user_id === user.id) {
      console.log('Self-view detected, not recording view');
      setViewRecorded(true); // Mark as recorded to prevent further attempts
      return;
    }

    try {
      const { data, error } = await supabase.rpc('record_video_view' as any, {
        video_uuid: video.id
      });

      // The function returns a boolean indicating if the view was recorded
      // If there's no error, consider the view recorded
      if (error === null) {
        setViewRecorded(true);

        // Update view count locally only if the view was actually recorded (data === true)
        // This ensures the UI is updated only for genuine views
        if (data === true) {
          setViewCounts(prev => ({
            ...prev,
            [video.id]: (prev[video.id] || 0) + 1
          }));

          // No onViewRecorded callback in this component
          // Removed reference to props.onViewRecorded
        }
      }
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };

  const checkViewCounts = async () => {
    try {
      // Get current view count from video data
      const viewCount = typeof video.view_count === 'number' ? video.view_count : 0;
      setViewCounts(prev => ({ ...prev, [video.id]: viewCount }));
      console.log(`Initial view count for video ${video.id}:`, viewCount);
    } catch (error) {
      console.error('Error checking view counts:', error);
    }
  };

  // Format view count for display
  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };



  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const checkSavedStatus = async () => {
    if (!user) return;
    try {
      const { data: saved } = await supabase
        .from('saved_videos' as any)
        .select('video_id')
        .eq('user_id', user.id)
        .eq('video_id', video.id);
      setSavedStatus(prev => ({ ...prev, [video.id]: !!(saved && saved.length) }));
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };


  const handleSave = async (videoId: string) => {
    if (!user) return;
    try {
      if (savedStatus[videoId]) {
        // Unsave
        await supabase
          .from('saved_videos' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
        setSavedStatus(prev => ({ ...prev, [videoId]: false }));
        toast({ description: 'Removed from Saved Videos.' });
      } else {
        // Save
        await supabase
          .from('saved_videos' as any)
          .insert({ user_id: user.id, video_id: videoId });
        setSavedStatus(prev => ({ ...prev, [videoId]: true }));
        toast({ description: 'Saved to your Saved Videos!' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Could not update saved status.', variant: 'destructive' });
    }
  };

  // Fetch the latest profile data for the video creator
  const fetchLatestProfileData = useCallback(async () => {
    if (!video.user_id) return;

    try {
      console.log('Fetching latest profile data for user:', video.user_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', video.user_id)
        .single();

      if (!error && data) {
        console.log('Latest profile data fetched:', data);
        // Update local state for immediate UI update
        setLatestProfileData(data);
      }
    } catch (error) {
      console.error('Error fetching latest profile data:', error);
    }
  }, [video.user_id]);

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!video.user_id) return;

    console.log('Setting up real-time subscription for profile updates:', video.user_id);

    // Fetch initial profile data
    fetchLatestProfileData();

    // Subscribe to profile changes
    const profileChannel = supabase
      .channel(`profile-${video.user_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${video.user_id}`
      }, (payload) => {
        console.log('Profile update received:', payload);

        // Update the profile data in state
        if (payload.new) {
          setLatestProfileData({
            username: payload.new.username,
            avatar_url: payload.new.avatar_url
          });
        }
      })
      .subscribe((status) => {
        console.log('Profile subscription status:', status);
      });

    return () => {
      console.log('Cleaning up profile subscription');
      supabase.removeChannel(profileChannel);
    };
  }, [video.user_id]);

  // Removed duplicate fetchLatestProfile function

  useEffect(() => {
    checkFollowStatus();
    checkLikeStatus();
    checkViewCounts();
    checkSavedStatus();
    fetchLatestProfileData(); // Fetch the latest profile data
  }, [video.id, user, fetchLatestProfileData]);

  // Record view when video starts playing
  useEffect(() => {
    if (isPlaying && !viewRecorded) {
      recordView();
    }
  }, [isPlaying, viewRecorded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * video.duration;
    video.currentTime = newTime;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X size={24} />
          </Button>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/10"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <video
          ref={videoRef}
          src={video.video_url}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
        />

        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <Play size={32} />
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <div
            className="w-full h-1 bg-white/30 rounded cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-white rounded"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-white text-sm mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="absolute inset-0 flex items-center justify-between p-4 pointer-events-none">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="text-white hover:bg-white/10 pointer-events-auto"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={currentIndex === videos.length - 1}
            className="text-white hover:bg-white/10 pointer-events-auto"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Side Actions */}
      <div className="flex flex-col items-center space-y-4 absolute right-4 top-1/2 -translate-y-1/2 z-20">
        {/* Like Button */}
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
              size={28}
              className={`${likeStatus[video.id] ? 'text-red-500 fill-red-500' : 'text-white'} transition-colors`}
            />
          </Button>
          <span className="text-white text-xs mt-1 font-medium">
            {likeCounts[video.id] || 0}
          </span>
        </div>

        {/* View Count */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Eye size={28} className="text-white" />
          </div>
          <span className="text-white text-xs mt-1 font-medium">
            {formatViews(viewCounts[video.id] || 0)}
          </span>
        </div>

        {/* Save Button */}
        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={e => { e.stopPropagation(); handleSave(video.id); }}
            className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
            data-control
          >
            {savedStatus[video.id] ? <BookmarkCheck size={28} className="text-green-400" /> : <Bookmark size={28} className="text-white" />}
          </Button>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
            data-control
          >
            <Share size={28} className="text-white" />
          </Button>
        </div>
      </div>

      {/* Video Info */}
      <div className="absolute bottom-20 left-4 right-20 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage
                src={latestProfileData?.avatar_url || video.profiles?.avatar_url}
                alt={latestProfileData?.username || getUsername(video)}
              />
              <AvatarFallback className="bg-gray-600 text-white font-semibold">
                {getUsername(video).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {user && video.user_id !== user.id && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleFollow(video.user_id, getUsername(video));
                }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center"
              >
                {followStatus[video.user_id] ? (
                  <span className="text-white text-xs">âœ“</span>
                ) : (
                  <Plus size={10} className="text-white" />
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
              className="text-white font-semibold hover:text-white/80 transition-colors"
            >
              @{getUsername(video)}
            </button>
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-1">{video.title}</h3>
        {video.description && (
          <p className="text-white/90 text-sm">{video.description}</p>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        video={video}
      />
    </div>
  );
};

export default VideoPlayer;