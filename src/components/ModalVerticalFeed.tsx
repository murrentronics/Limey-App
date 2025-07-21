import AutoPlayVideo from "@/components/AutoPlayVideo";
import React, { useRef, useEffect, useState } from "react";
import { X, MessageCircle, Share2, Volume2, VolumeX, Plus, Heart, Eye } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface ModalVerticalFeedProps {
  videos: any[];
  startIndex: number;
  onClose: () => void;
}

const ModalVerticalFeed = ({ videos, startIndex, onClose }: ModalVerticalFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [globalMuted, setGlobalMuted] = useState(false);

  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [likeStatus, setLikeStatus] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const [viewCounts, setViewCounts] = useState<{ [key: string]: number }>({});
  const [modalVideos, setModalVideos] = useState(videos);

  // Only update modalVideos when videos prop changes
  useEffect(() => {
    setModalVideos(videos);
  }, [videos]);

  // Only update currentIndex and scroll when startIndex changes
  useEffect(() => {
    setCurrentIndex(startIndex);
    if (containerRef.current) {
      const child = containerRef.current.children[startIndex] as HTMLElement;
      if (child) child.scrollIntoView({ behavior: "auto" });
    }
  }, [startIndex]);

  // Follow status check
  useEffect(() => {
    if (!user) return;
    const userIds = modalVideos.map((v) => v.user_id).filter((id) => id !== user.id);

    const checkFollowStatus = async () => {
      if (userIds.length === 0) return;
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', userIds);
      const followingSet = new Set(follows?.map(f => f.following_id) || []);
      const newFollowStatus: { [key: string]: boolean } = {};
      modalVideos.forEach(video => {
        if (video.user_id !== user.id) {
          newFollowStatus[video.user_id] = followingSet.has(video.user_id);
        }
      });
      setFollowStatus(newFollowStatus);
    };
    checkFollowStatus();
  }, [user, modalVideos]);

  // Check like status and view counts
  useEffect(() => {
    if (!user || modalVideos.length === 0) return;

    const checkLikeStatus = async () => {
      try {
        const videoIds = modalVideos.map(video => video.id);

        // Check which videos the user has liked
        const { data: likes } = await supabase
          .from('video_likes')
          .select('video_id')
          .eq('user_id', user.id)
          .in('video_id', videoIds);

        const likedVideoIds = new Set(likes?.map(like => like.video_id) || []);

        // Update like status and counts
        const newLikeStatus: { [key: string]: boolean } = {};
        const newLikeCounts: { [key: string]: number } = {};
        const newViewCounts: { [key: string]: number } = {};

        modalVideos.forEach(video => {
          newLikeStatus[video.id] = likedVideoIds.has(video.id);
          newLikeCounts[video.id] = video.like_count || 0;
          newViewCounts[video.id] = video.view_count || 0;
        });

        setLikeStatus(newLikeStatus);
        setLikeCounts(newLikeCounts);
        setViewCounts(newViewCounts);

      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [user, modalVideos]);



  const handleFollow = async (video: any) => {
    if (!user) return;
    const alreadyFollowing = followStatus[video.user_id];
    if (alreadyFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', video.user_id);
      setFollowStatus((prev) => ({ ...prev, [video.user_id]: false }));
    } else {
      // Check for existing follow before inserting
      const { data: existingFollow } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', video.user_id)
        .single();
      if (!existingFollow) {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: video.user_id });
        if (!error) {
          setFollowStatus((prev) => ({ ...prev, [video.user_id]: true }));
        }
        // If error is 409 or duplicate, ignore
        if (error && error.code !== '23505') {
          console.error('Error following:', error);
        }
      }
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
      navigator.clipboard.writeText(videoUrl);
    }
  };

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

  const handleDelete = async (video: any) => {
    if (!user || video.user_id !== user.id) return;
    await supabase.from('videos').delete().eq('id', video.id);
    // Optionally: remove from UI
    // Optionally: show toast
  };

  // Format view count for display
  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  const getUsername = (video: any) => video.profiles?.username || video.username || (video.user_id ? `user_${video.user_id.slice(0, 8)}` : 'unknown');
  const getAvatarUrl = (video: any) => video.profiles?.avatar_url || video.avatar_url || undefined;

  const renderDescription = (desc: string) => {
    if (!desc) return null;
    return desc.split(/(#[\w-]+)/g).map((part, i) => {
      if (/^#[\w-]+$/.test(part)) {
        return (
          <button
            key={i}
            className="inline-block text-green-400 hover:text-green-600 font-semibold px-1"
            onClick={e => {
              e.stopPropagation();
              // TODO: Implement filter by hashtag
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <button
        className="absolute top-4 right-4 z-50 text-white bg-black/60 rounded-full p-2"
        onClick={onClose}
      >
        <X size={32} />
      </button>
      {/* Mute Toggle */}
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
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {modalVideos.map((video, idx) => (
          <div
            key={video.id}
            className="relative h-screen flex items-center justify-center snap-start"
            style={{ scrollSnapAlign: "start" }}
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
                        <AvatarImage src={getAvatarUrl(video)} alt={getUsername(video)} />
                        <AvatarFallback>{getUsername(video).charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {/* Follow Button */}
                      {user && video.user_id !== user.id && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleFollow(video);
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
                          navigate(`/profile/${getUsername(video)}`);
                        }}
                        className="text-white font-semibold text-lg hover:text-white/80 transition-colors"
                      >
                        @{getUsername(video)}
                      </button>
                    </div>
                    {/* Vertical Menu removed */}
                  </div>
                  {/* Caption */}
                  <div className="space-y-2 mt-2">
                    <h3 className="text-white font-semibold text-base leading-tight">{video.title}</h3>
                    {/* Category badge */}
                    {video.category && (
                      <Badge className="bg-green-900 text-green-400 text-xs font-semibold mb-1">{video.category}</Badge>
                    )}
                    {/* Description with hashtags */}
                    {video.description && (
                      <p className="text-white/90 text-sm leading-relaxed break-words">
                        {renderDescription(video.description)}
                      </p>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex flex-col items-center space-y-6">
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
                        size={24}
                        className={`${likeStatus[video.id] ? 'text-red-500 fill-red-500' : 'text-white'} transition-colors`}
                      />
                    </Button>
                    <span className="text-white text-xs font-semibold mt-1">
                      {likeCounts[video.id] || 0}
                    </span>
                  </div>

                  {/* View Count */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Eye size={24} className="text-white" />
                    </div>
                    <span className="text-white text-xs font-semibold mt-1">
                      {formatViews(viewCounts[video.id] || 0)}
                    </span>
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
    </div>
  );
};

export default ModalVerticalFeed;