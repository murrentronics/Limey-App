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
  setVideos: React.Dispatch<React.SetStateAction<any[]>>;
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

// ...existing code...
const VideoPlayer = ({ video, videos, setVideos, currentIndex, onClose, onNext, onPrevious }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
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
    if (!user || !newComment.trim()) return;
    const { error, data } = await supabase.from("comments").insert({
      content: newComment,
      user_id: user.id,
      video_id: video.id,
    }).select("*, profiles(username, avatar_url)").single();
    if (!error && data) {
      const fixedData = {
        ...data,
        profiles: hasProfile(data.profiles) ? data.profiles : null,
      } as CommentRow;
      setComments((prev) => [fixedData, ...prev]);
      setNewComment("");
    }
  };

  // Edit comment
  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    const { error, data } = await supabase.from("comments").update({
      content: editText,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*, profiles(username, avatar_url)").single();
    if (!error && data) {
      const fixedData = {
        ...data,
        profiles: hasProfile(data.profiles) ? data.profiles : null,
      } as CommentRow;
      setComments((prev) => prev.map((c) => c.id === id ? fixedData : c));
      setEditingComment(null);
      setEditText("");
    }
  };

  // Delete comment
  const handleDeleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setEditingComment(null);
      setEditText("");
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
    setEditingComment(null);
    setEditText("");
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
    setTouchStartY(e.touches[0].clientY);
    setTouchStartTime(Date.now());
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

  // Like/unlike logic (revert to previous working version)
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

        setIsLiked(false);

        const currentVideo = videos.find(v => v.id === videoId);
        if (currentVideo) {
          const newLikeCount = Math.max((currentVideo.like_count || 0) - 1, 0);
          await supabase
            .from('videos')
            .update({ like_count: newLikeCount })
            .eq('id', videoId);

          setVideos(prev =>
            prev.map(v =>
              v.id === videoId ? { ...v, like_count: newLikeCount } : v
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

        setIsLiked(true);

        const currentVideo = videos.find(v => v.id === videoId);
        if (currentVideo) {
          const newLikeCount = (currentVideo.like_count || 0) + 1;
          await supabase
            .from('videos')
            .update({ like_count: newLikeCount })
            .eq('id', videoId);

          setVideos(prev =>
            prev.map(v =>
              v.id === videoId ? { ...v, like_count: newLikeCount } : v
            )
          );
        }
      }
    } catch (error) {
      console.error('Error updating like status:', error);
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
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });
        setFollowStatus(prev => ({ ...prev, [targetUserId]: true }));
        return true; // now following
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

  const checkLikeStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('video_likes')
        .select('*')
        .eq('video_id', video.id)
        .eq('user_id', user.id)
        .single();
      setIsLiked(!!data);
    } catch (error) {
      setIsLiked(false);
    }
  };

  useEffect(() => {
    checkFollowStatus();
    checkLikeStatus();
  }, [video.id, user]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

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
      <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-6">
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
        </div>
      </div>

      {/* Video Info */}
      <div className="absolute bottom-20 left-4 right-20 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-white font-semibold">
                {getUsername(video).charAt(0).toUpperCase()}
              </span>
            </div>
            {user && video.user_id !== user.id && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleFollow(video.user_id, getUsername(video));
                }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center"
              >
                {followStatus[video.user_id] ? (
                  <span className="text-white text-xs">✓</span>
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
                const navigate = useNavigate();
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

      {/* Comments Section */}
      {showComments && (
        <div className="absolute inset-0 bg-black/90 z-20">
          <div className="flex flex-col h-full">
            {/* Comments Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/20">
              <h3 className="text-white font-semibold">Comments</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComments(false)}
                className="text-white hover:bg-white/10"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {comment.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-white font-semibold text-sm">
                        @{comment.profiles?.username || 'unknown'}
                      </span>
                      <span className="text-white/60 text-xs">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {editingComment === comment.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full p-2 bg-white/10 text-white rounded resize-none"
                          rows={2}
                        />
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(comment.id)}
                            className="bg-white text-black hover:bg-white/90"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="text-white border-white/20 hover:bg-white/10"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <p className="text-white text-sm">{comment.content}</p>
                        {user && comment.user_id === user.id && (
                          <div className="flex space-x-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingComment(comment.id);
                                setEditText(comment.content);
                              }}
                              className="text-white/60 hover:text-white text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="p-4 border-t border-white/20">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 p-2 bg-white/10 text-white rounded placeholder-white/50"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddComment();
                    }
                  }}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;