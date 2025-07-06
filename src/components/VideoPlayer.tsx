// Helper type guard for profiles
  function hasProfile(obj: any): obj is { username: string } {
    return obj && typeof obj === "object" && typeof obj.username === "string";
  }
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX, Heart, MessageCircle, Share, Play, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Video {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  user_id: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

interface VideoPlayerProps {
  video: Video;
  videos: Video[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

// ...existing code...
const VideoPlayer = ({ video, videos, currentIndex, onClose, onNext, onPrevious }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [startY, setStartY] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Comments state and logic moved inside component
  type CommentRow = {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    video_id: string;
    profiles?: { username: string; avatar_url?: string } | null;
  };
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComment, setLoadingComment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showMenuId, setShowMenuId] = useState<string | null>(null);

  const viewTimer = useRef<NodeJS.Timeout | null>(null);
  const hasRecordedView = useRef(false);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles(username, avatar_url)")
        .eq("video_id", video.id)
        .order("created_at", { ascending: false });
      if (!error && data) {
        // Ensure profiles is either a valid object or null
        const fixedComments = (data as any[]).map((c) => ({
          ...c,
          profiles: hasProfile(c.profiles) ? c.profiles : null,
        })) as CommentRow[];
        setComments(fixedComments);
      }
    };
    fetchComments();
  }, [video.id]);

  // Add comment
  const handleAddComment = async () => {
    if (!user || !commentInput.trim()) return;
    setLoadingComment(true);
    const { error, data } = await supabase.from("comments").insert({
      content: commentInput,
      user_id: user.id,
      video_id: video.id,
    }).select("*, profiles(username, avatar_url)").single();
    if (!error && data) {
      const fixedData = {
        ...data,
        profiles: hasProfile(data.profiles) ? data.profiles : null,
      } as CommentRow;
      setComments((prev) => [fixedData, ...prev]);
      setCommentInput("");
    }
    setLoadingComment(false);
  };

  // Edit comment
  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    const { error, data } = await supabase.from("comments").update({
      content: editValue,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*, profiles(username, avatar_url)").single();
    if (!error && data) {
      const fixedData = {
        ...data,
        profiles: hasProfile(data.profiles) ? data.profiles : null,
      } as CommentRow;
      setComments((prev) => prev.map((c) => c.id === id ? fixedData : c));
      setEditingId(null);
      setEditValue("");
      setShowMenuId(null);
    }
  };

  // Delete comment
  const handleDeleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setEditingId(null);
      setEditValue("");
      setShowMenuId(null);
    }
  };
  // Restore handleShare function
  const handleShare = async () => {
    try {
      await navigator.share({
        title: video.title,
        text: video.description,
        url: window.location.href
      });
    } catch (error) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "Video link copied to clipboard"
      });
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setShowMenuId(null);
  };

  useEffect(() => {
    // Reset timer and flag when video changes
    hasRecordedView.current = false;
    if (viewTimer.current) {
      clearTimeout(viewTimer.current);
      viewTimer.current = null;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [video.id, user]);

  const handleTimeUpdate = () => {
    if (!user || video.user_id === user.id || hasRecordedView.current) return;
    if (videoRef.current && videoRef.current.currentTime >= 10) {
      recordVideoView(video.id, video.user_id);
      hasRecordedView.current = true;
    }
  };

  // Record video view (only for other users' videos)
  const recordVideoView = async (videoId: string, creatorId: string) => {
    if (!user || user.id === creatorId) return; // Don't record own views
    
    try {
      // Call the database function to record the view
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

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diffY = startY - endY;
    
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

  // Like/unlike logic (revert to previous working version)
  const handleLike = async () => {
    if (!user) return;
    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('video_likes')
          .delete()
          .eq('video_id', video.id)
          .eq('user_id', user.id);
        setIsLiked(false);
      } else {
        // Like
        await supabase
          .from('video_likes')
          .insert({
            video_id: video.id,
            user_id: user.id
          });
        setIsLiked(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive"
      });
    }
  };

  // Restore togglePlay and toggleMute
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Fallbacks for missing metadata
  const displayTitle = video.title || (video.video_url ? video.video_url.split('/').pop() : 'Untitled');
  const displayDescription = video.description || 'No description available.';
  const displayDuration = video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '--:--';
  const displayUsername = video.profiles?.username || 'unknown';
  const displayAvatar = video.profiles?.avatar_url || '';

  // Helper function to get username with fallback
  const getUsername = (video: any) => {
    // First try to get username from profiles
    if (video.profiles?.username) {
      return video.profiles.username;
    }
    
    // If no username in profiles, create a fallback from user_id
    if (video.user_id) {
      // Create a more user-friendly fallback username
      const userId = video.user_id.replace(/[^a-zA-Z0-9]/g, '');
      return `user_${userId.slice(0, 8)}`;
    }
    
    // Last resort fallback
    return 'unknown_user';
  };

  // Helper function to get profile URL for navigation
  const getProfileUrl = (video: any) => {
    const username = getUsername(video);
    // If this is the current user's video, navigate to their own profile
    if (user && video.user_id === user.id) {
      return '/profile';
    }
    return `/profile/${username}`;
  };

  const navigate = useNavigate();

  // Follow function
  const handleFollow = async (targetUserId: string, targetUsername: string) => {
    if (!user) return;
    
    try {
      // Check if already following
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
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black z-50"
      style={{ 
        top: '64px', // Account for top header
        bottom: '80px' // Account for bottom navigation
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={e => {
        // Only trigger play/pause if not clicking on a control (close or mute)
        const controlSelectors = ['button[data-control]'];
        let el: HTMLElement | null = e.target as HTMLElement;
        while (el && el !== e.currentTarget) {
          if (controlSelectors.some(sel => el.matches(sel))) {
            return;
          }
          el = el.parentElement;
        }
        togglePlay();
      }}
    >
      <div className="relative w-full h-full">
        {/* Video */}
        <video
          ref={videoRef}
          src={video.video_url}
          poster={video.thumbnail_url || undefined}
          className="w-full h-full object-cover"
          loop
          autoPlay
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white p-2 bg-black/30 hover:bg-black/50 rounded-full"
            data-control
          >
            <X size={20} />
          </Button>
        </div>

        {/* Center Play Button - Only show when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <Button
              variant="ghost"
              className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white pointer-events-auto"
              style={{ pointerEvents: 'none' }}
              tabIndex={-1}
            >
              <Play size={32} className="ml-1" />
            </Button>
          </div>
        )}

        {/* Bottom Content - TikTok Style */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <div className="flex justify-between items-end">
            {/* Left Side - User Info and Caption */}
            <div className="flex-1 mr-4 space-y-3">
              {/* User Profile - Raised like TikTok */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-red-500 p-0.5">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                      {displayAvatar ? (
                        <img 
                          src={displayAvatar} 
                          alt="Profile" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {getUsername(video).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Follow button - only show if not the current user */}
                  {user && video.user_id !== user.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(video.user_id, getUsername(video));
                      }}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
                      data-control
                    >
                      <Plus size={12} className="text-black" />
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

              {/* Video Caption */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-base leading-tight">
                  {displayTitle}
                </h3>
                {displayDescription && (
                  <p className="text-white/90 text-sm leading-relaxed">
                    {displayDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Right Side Actions - TikTok Style Vertical */}
            <div className="flex flex-col items-center space-y-6">
              {/* Like Button */}
              <div className="flex flex-col items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
                  data-control
                >
                  <Heart 
                    size={28} 
                    className={`${isLiked ? "fill-red-500 text-red-500" : "text-white"} transition-colors`} 
                  />
                </Button>
                <span className="text-white text-xs font-semibold mt-1">
                  {video.like_count || 0}
                </span>
              </div>

              {/* Comment Button */}
              <div className="flex flex-col items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-12 h-12 rounded-full p-0 bg-white/20 hover:bg-white/30 text-white"
                  data-control
                >
                  <MessageCircle size={28} className="text-white" />
                </Button>
                <span className="text-white text-xs font-semibold mt-1">
                  {video.comment_count || 0}
                </span>
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
                <span className="text-white text-xs font-semibold mt-1">
                  Share
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;