import AutoPlayVideo from "@/components/AutoPlayVideo";
import { useRef, useEffect, useState } from "react";
import { X, Share2, Volume2, VolumeX, Plus, Heart, Eye, Bookmark } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ShareModal from "@/components/ShareModal";


// Move this to the top after the imports
interface SavedVideoRow {
  video_id: string;
}

interface ModalVerticalFeedProps {
  videos: any[];
  startIndex: number;
  onClose: () => void;
}

const ModalVerticalFeed = ({ videos, startIndex, onClose }: ModalVerticalFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [globalMuted, setGlobalMuted] = useState(false);

  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [likeStatus, setLikeStatus] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const [viewCounts, setViewCounts] = useState<{ [key: string]: number }>({});
  const [shareCounts, setShareCounts] = useState<{ [key: string]: number }>({});
  const [saveCounts, setSaveCounts] = useState<{ [key: string]: number }>({});
  const [modalVideos, setModalVideos] = useState(videos);
  const [savedStatus, setSavedStatus] = useState<{ [key: string]: boolean }>({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareVideo, setShareVideo] = useState<any>(null);

  // Only update modalVideos when videos prop changes
  useEffect(() => {
    setModalVideos(videos);
  }, [videos]);

  // Scroll to start index when it changes
  useEffect(() => {
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
        const newShareCounts: { [key: string]: number } = {};
        const newSaveCounts: { [key: string]: number } = {};

        modalVideos.forEach(video => {
          newLikeStatus[video.id] = likedVideoIds.has(video.id);
          newLikeCounts[video.id] = video.like_count || 0;
          newShareCounts[video.id] = video.share_count || 0;
          newSaveCounts[video.id] = video.save_count || 0;
        });

        setLikeStatus(newLikeStatus);
        setLikeCounts(newLikeCounts);
        setShareCounts(newShareCounts);
        setSaveCounts(newSaveCounts);

      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    const checkViewCounts = async () => {
      try {
        const newViewCounts: { [key: string]: number } = {};

        // Get genuine view counts from the database function
        for (const video of modalVideos) {
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

        setViewCounts(newViewCounts);

      } catch (error) {
        console.error('Error checking view counts:', error);
      }
    };

    checkLikeStatus();
    checkViewCounts();
  }, [user, modalVideos]);

  // Then update the function:
  const checkSavedStatus = async () => {
    if (!user || modalVideos.length === 0) return;
    try {
      const videoIds = modalVideos.map(video => video.id);

      const { data: saved, error } = await (supabase as any)
        .from('saved_videos')
        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds);

      if (error) {
        console.error('Error fetching saved videos:', error);
        return;
      }

      const savedVideoIds = new Set((saved as SavedVideoRow[] || []).map(row => row.video_id));
      const newSavedStatus: { [key: string]: boolean } = {};
      modalVideos.forEach(video => {
        newSavedStatus[video.id] = savedVideoIds.has(video.id);
      });
      setSavedStatus(newSavedStatus);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };



  const handleSave = async (videoId: string) => {
    if (!user) return;
    try {
      if (savedStatus[videoId]) {
        // Remove from saved videos
        await (supabase as any)
          .from('saved_videos')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);

        // Update local state
        setSavedStatus(prev => ({ ...prev, [videoId]: false }));
        setSaveCounts(prev => ({
          ...prev,
          [videoId]: Math.max((prev[videoId] || 0) - 1, 0)
        }));
      } else {
        // Add to saved videos
        await (supabase as any)
          .from('saved_videos')
          .insert({ user_id: user.id, video_id: videoId });

        // Update local state
        setSavedStatus(prev => ({ ...prev, [videoId]: true }));
        setSaveCounts(prev => ({
          ...prev,
          [videoId]: (prev[videoId] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Error saving/unsaving video:', error);
    }
  };


  useEffect(() => {
    checkSavedStatus();
  }, [user, modalVideos]);

  // Real-time subscriptions for likes and views
  useEffect(() => {
    if (!user) return;

    // Subscribe to video_views changes
    const viewsChannel = supabase
      .channel('modal_video_views_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_views'
      }, async (payload) => {
        console.log('ModalVerticalFeed: View change detected via real-time:', payload);
        const newView = payload.new;

        if (newView && newView.video_id) {
          console.log('ModalVerticalFeed: Updating view count for video:', newView.video_id);

          // Get the genuine view count from the database
          try {
            const { data: genuineCount, error } = await supabase.rpc('get_genuine_view_count', {
              video_uuid: newView.video_id
            });

            if (!error && typeof genuineCount === 'number') {
              setViewCounts(prev => {
                console.log('ModalVerticalFeed: View count updated via real-time:', newView.video_id, 'to', genuineCount);
                return {
                  ...prev,
                  [newView.video_id]: genuineCount
                };
              });
            } else {
              // Fallback to incrementing
              setViewCounts(prev => {
                const newCount = (prev[newView.video_id] || 0) + 1;
                console.log('ModalVerticalFeed: View count updated (fallback):', newView.video_id, 'from', prev[newView.video_id] || 0, 'to', newCount);
                return {
                  ...prev,
                  [newView.video_id]: newCount
                };
              });
            }
          } catch (error) {
            console.error('ModalVerticalFeed: Error getting genuine view count:', error);
            // Fallback to incrementing
            setViewCounts(prev => {
              const newCount = (prev[newView.video_id] || 0) + 1;
              return {
                ...prev,
                [newView.video_id]: newCount
              };
            });
          }
        }
      })
      .subscribe();

    // Subscribe to videos table changes for share and save counts
    const videosChannel = supabase
      .channel('modal_videos_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos'
      }, async (payload) => {
        console.log('ModalVerticalFeed: Video change detected via real-time:', payload);

        if (payload.new && payload.old) {
          const videoId = payload.new.id;
          const newShareCount = payload.new.share_count || 0;
          const newSaveCount = payload.new.save_count || 0;

          // Update share count if changed
          if (payload.new.share_count !== payload.old.share_count) {
            setShareCounts(prev => ({
              ...prev,
              [videoId]: newShareCount
            }));
          }

          // Update save count if changed
          if (payload.new.save_count !== payload.old.save_count) {
            setSaveCounts(prev => ({
              ...prev,
              [videoId]: newSaveCount
            }));
          }
        }
      })
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(viewsChannel);
      supabase.removeChannel(videosChannel);
    };
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
    try {
      // Increment share count directly in database
      const { error } = await supabase
        .from('videos')
        .update({
          share_count: (video.share_count || 0) + 1
        })
        .eq('id', video.id);

      if (!error) {
        // Update local share count
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



  // Handle view recording
  const onViewRecorded = async (videoId: string) => {
    // Get the updated view count from the database
    try {
      const { data: genuineCount, error } = await supabase.rpc('get_genuine_view_count', {
        video_uuid: videoId
      });

      if (!error && typeof genuineCount === 'number') {
        setViewCounts(prev => ({
          ...prev,
          [videoId]: genuineCount
        }));
        console.log(`Updated view count for video ${videoId}: ${genuineCount}`);
      } else {
        // Fallback to incrementing the current count
        setViewCounts(prev => ({
          ...prev,
          [videoId]: (prev[videoId] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Error updating view count:', error);
      // Fallback to incrementing the current count
      setViewCounts(prev => ({
        ...prev,
        [videoId]: (prev[videoId] || 0) + 1
      }));
    }
  };

  // Format view count for display
  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  const getUsername = (video: any) => video.profiles?.username || video.username || (video.user_id ? `user_${video.user_id.slice(0, 8)}` : 'unknown');
  const getProfileUrl = (video: any) => {
    const username = getUsername(video);
    if (user && video.user_id === user.id) {
      return '/profile';
    }
    return `/profile/${username}`;
  };


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
        {modalVideos.map((video) => (
          <div
            key={video.id}
            className="relative h-screen snap-start snap-always flex items-center justify-center"
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
            {/* Black space for top menu */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-black z-10"></div>

            {/* Video container with fixed height - stops above the text area */}
            <div className="absolute inset-0 top-16 bottom-32 overflow-hidden">
              {/* Video */}
              <AutoPlayVideo
                src={video.video_url}
                className="w-full h-full object-cover"
                globalMuted={globalMuted}
                videoId={video.id}
                user={user}
                onViewRecorded={onViewRecorded}
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
                        {renderDescription(video.description)}
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
                            await handleFollow(video);
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

export default ModalVerticalFeed;