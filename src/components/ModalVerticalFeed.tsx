import AutoPlayVideo from "@/components/AutoPlayVideo";
import React, { useRef, useEffect, useState } from "react";
import { X, MoreVertical, Heart, MessageCircle, Share2, Play, Volume2, VolumeX, Plus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { handleLike as handleLikeUtil } from "@/lib/likes";

const ModalVerticalFeed = ({ videos, startIndex, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [isLiked, setIsLiked] = useState<{ [key: string]: boolean }>({});
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
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

  // Like/follow status check
  useEffect(() => {
    if (!user) return;
    const videoIds = modalVideos.map((v) => v.id);
    const userIds = modalVideos.map((v) => v.user_id).filter((id) => id !== user.id);
    const checkLikeStatus = async () => {
      const { data: likes } = await supabase
        .from('video_likes')
        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds);
      const likedVideoIds = new Set(likes?.map(like => like.video_id) || []);
      const newLikeStatus: { [key: string]: boolean } = {};
      modalVideos.forEach(video => {
        newLikeStatus[video.id] = likedVideoIds.has(video.id);
      });
      setIsLiked(newLikeStatus);
    };
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
    checkLikeStatus();
    checkFollowStatus();
  }, [user, modalVideos]);

  const handleLike = async (video) => {
    if (!user) return;
    await handleLikeUtil(video.id, user.id);
  };

  const handleFollow = async (video) => {
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
      await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: video.user_id });
      setFollowStatus((prev) => ({ ...prev, [video.user_id]: true }));
    }
  };

  const handleShare = async (video) => {
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

  const handleDelete = async (video) => {
    if (!user || video.user_id !== user.id) return;
    await supabase.from('videos').delete().eq('id', video.id);
    // Optionally: remove from UI
    // Optionally: show toast
  };

  const getUsername = (video) => video.profiles?.username || video.username || (video.user_id ? `user_${video.user_id.slice(0, 8)}` : 'unknown');
  const getAvatarUrl = (video) => video.profiles?.avatar_url || video.avatar_url || undefined;

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
              videoId={video.id}
              creatorId={video.user_id}
              onViewRecorded={() => {}}
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
                    <p className="text-white/90 text-sm leading-relaxed break-words">
                      {video.description || <span className="text-white/50 italic">No description</span>}
                    </p>
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
                        handleLike(video);
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
    </div>
  );
};

export default ModalVerticalFeed;