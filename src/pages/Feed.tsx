import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Search as SearchIcon, X as CloseIcon, Share2, Play, Volume2, VolumeX, Plus, Pause, TrendingUp, ArrowLeft, Heart, Eye, Bookmark, BookmarkCheck } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import React from "react";

// --- AutoPlayVideo component ---
const AutoPlayVideo = ({ src, className, globalMuted, videoId, onViewRecorded, ...props }) => {
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Always start muted to allow autoplay
    video.muted = true;

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          setIsVisible(true);
          // Try to play the video
          video.play().catch(error => {
            console.log('Autoplay prevented:', error);
            // Video will remain paused until user interaction
          });
        } else {
          setIsVisible(false);
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);

    // After a short delay, apply the actual muted state
    // This ensures autoplay works first, then we can unmute if needed
    const timer = setTimeout(() => {
      video.muted = globalMuted;
    }, 1000);

    return () => {
      observer.unobserve(video);
      clearTimeout(timer);
    };
  }, [globalMuted]);

  // Record view when video has been playing and visible for 5 seconds
  useEffect(() => {
    if (isVisible && isPlaying && !viewRecorded && videoId) {
      const timer = setTimeout(async () => {
        try {
          const { data, error } = await supabase.rpc('record_video_view', {
            video_uuid: videoId
          });

          if (!error && data) {
            setViewRecorded(true);
            if (onViewRecorded) {
              onViewRecorded(videoId);
            }
          }
        } catch (error) {
          console.error('Error recording view:', error);
        }
      }, 5000); // 5 seconds delay

      return () => clearTimeout(timer);
    }
  }, [isVisible, isPlaying, viewRecorded, videoId, onViewRecorded]);

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
      {/* Show play/pause button overlay */}
      {isVisible && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white"
            aria-label="Play"
            data-control
          >
            <Play size={32} />
          </button>
        </div>
      )}
    </div>
  );
};

const Feed = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({});
  const [isMuted, setIsMuted] = useState<{ [key: string]: boolean }>({});
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [likeStatus, setLikeStatus] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const [viewCounts, setViewCounts] = useState<{ [key: string]: number }>({});
  const [globalMuted, setGlobalMuted] = useState(false); // Start unmuted (sound ON)
  const [savedStatus, setSavedStatus] = useState<{ [key: string]: boolean }>({});
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { user } = useAuth();

  const categories = [
    "Soca", "Dancehall", "Carnival", "Comedy", "Dance", "Music", "Local News"
  ];

  const currentVideos = searchResults !== null ? searchResults : videos;

  // Filtering logic for hashtag
  const filteredVideos = React.useMemo(() => {
    if (activeHashtag) {
      return videos.filter(v => v.description && v.description.toLowerCase().includes(`#${activeHashtag.toLowerCase()}`));
    }
    if (activeCategory && activeCategory !== "All") {
      return videos.filter(v => v.category === activeCategory);
    }
    return videos;
  }, [videos, activeCategory, activeHashtag]);



  useEffect(() => {
    console.log("Feed - fetching videos for category:", activeCategory);
    fetchVideos();
  }, [activeCategory]);



  // Focus search input when shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Real-time subscriptions for likes and views
  useEffect(() => {
    if (!user) return;

    // Subscribe to videos table changes for like_count updates
    const videosChannel = supabase
      .channel('videos_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos'
      }, async (payload) => {
        console.log('Video updated:', payload);

        try {
          if (payload.new && payload.new.id) {
            const videoId = payload.new.id;
            const newLikeCount = payload.new.like_count || 0;
            const oldLikeCount = payload.old?.like_count || 0;

            // Always update the like count, even if it appears unchanged
            // This ensures the UI stays in sync with the database
            console.log(`Like count for video ${videoId}: ${oldLikeCount} -> ${newLikeCount}`);

            // Update like count based on the payload
            setLikeCounts(prev => ({
              ...prev,
              [videoId]: newLikeCount
            }));
          }
        } catch (error) {
          console.error('Unexpected error in videos realtime handler:', error);
        }
      })
      .subscribe();

    // Also subscribe to video_likes table for direct like status updates
    const likesChannel = supabase
      .channel('likes_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_likes'
      }, async (payload) => {
        console.log('Like change detected:', payload);

        try {
          if (payload.eventType === 'INSERT' && payload.new?.user_id === user.id) {
            // Handle INSERT events - user liked a video
            setLikeStatus(prev => ({
              ...prev,
              [payload.new.video_id]: true
            }));
          } else if (payload.eventType === 'DELETE') {
            // For DELETE events, we need to handle them differently
            console.log('DELETE event detected, payload:', payload);

            // Since we can't get the video_id from the payload due to REPLICA IDENTITY settings,
            // we'll use the videos update event to determine which video was unliked

            // We don't need to do anything here - the videos update event will handle updating the like count
            // and we'll use the optimistic update in handleLike to update the like status

            // This is just a fallback in case we do have the video_id in the payload
            if (payload.old && payload.old.video_id) {
              const videoId = payload.old.video_id;
              console.log('Found video_id in DELETE payload:', videoId);

              // Update like status for the specific video - assume it's the current user's action
              setLikeStatus(prev => ({
                ...prev,
                [videoId]: false
              }));
            }
          }
        } catch (error) {
          console.error('Error in likes realtime handler:', error);
        }
      })
      .subscribe();

    // Subscribe to video_views changes
    const viewsChannel = supabase
      .channel('video_views_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_views'
      }, (payload) => {
        console.log('View change detected:', payload);
        const newView = payload.new;

        // Update view count
        setViewCounts(prev => ({
          ...prev,
          [newView.video_id]: (prev[newView.video_id] || 0) + 1
        }));
      })
      .subscribe();

    // Subscribe to saved_videos changes
    const savedChannel = supabase
      .channel('saved_videos_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'saved_videos'
      }, async (payload) => {
        console.log('Saved video change detected:', payload);
        try {
          if (payload.eventType === 'INSERT' && payload.new?.user_id === user.id) {
            setSavedStatus(prev => ({
              ...prev,
              [payload.new.video_id]: true
            }));
          } else if (payload.eventType === 'DELETE') {
            if (payload.old && payload.old.user_id === user.id) {
              setSavedStatus(prev => ({
                ...prev,
                [payload.old.video_id]: false
              }));
            }
          }
        } catch (error) {
          console.error('Error in saved_videos realtime handler:', error);
        }
      })
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(viewsChannel);
      supabase.removeChannel(savedChannel);
    };
  }, [user, videos]);

  // Play first video only after user interaction
  useEffect(() => {
    // This effect is no longer needed as videos auto-play with sound ON
  }, [videos, loading]);

  // Search function
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    let query = supabase
      .from('videos')
      .select(`*, profiles!inner(username, avatar_url)`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (searchTerm.startsWith('#')) {
      const tag = searchTerm.replace('#', '').toLowerCase();
      query = query.ilike('description', `%#${tag}%`);
    } else if (searchTerm.startsWith('@')) {
      // Search by username (from profiles)
      const username = searchTerm.replace('@', '').toLowerCase();
      query = query.ilike('profiles.username', `%${username}%`);
    } else {
      // Default: search title, description, category, tags, and username
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%,profiles.username.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching videos with profiles:', error);
      // fallback search without profiles
      let fallbackQuery = supabase
        .from('videos')
        .select(`*`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchTerm.startsWith('#')) {
        const tag = searchTerm.replace('#', '').toLowerCase();
        fallbackQuery = fallbackQuery.ilike('description', `%#${tag}%`);
      } else if (searchTerm.startsWith('@')) {
        const username = searchTerm.replace('@', '').toLowerCase();
        fallbackQuery = fallbackQuery.ilike('username', `%${username}%`);
      } else {
        fallbackQuery = fallbackQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        console.error('Error searching videos without profiles:', fallbackError);
        setSearchResults([]);
      } else if (fallbackData && fallbackData.length > 0) {
        // fetch profiles
        const userIds = [...new Set(fallbackData.map(video => video.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', userIds);
        const profilesMap = new Map();
        if (profilesData) {
          profilesData.forEach(p => profilesMap.set(p.user_id, p));
        }
        const videosWithProfiles = fallbackData.map(video => ({
          ...video,
          profiles: profilesMap.get(video.user_id) || null
        }));
        setSearchResults(videosWithProfiles);
      } else {
        setSearchResults([]);
      }
    } else {
      setSearchResults(data || []);
      // Also check like status for search results
      await checkLikeStatus(data || []);
      await checkSavedStatus(data || []);
    }
    setSearchLoading(false);
  };

  const fetchVideos = async () => {
    console.log("Feed - fetchVideos called");
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('videos')
        .select(`*, like_count, view_count`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (activeCategory !== "All") {
        query = query.eq('category', activeCategory);
      }
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching videos:', error);
        setError('Failed to load videos. Please try again.');
        return;
      }

      console.log('Videos fetched:', data);

      // Initialize like counts from the fetched data
      const initialLikeCounts = {};
      data?.forEach(video => {
        initialLikeCounts[video.id] = video.like_count || 0;
      });

      // Update like counts immediately
      setLikeCounts(prev => ({ ...prev, ...initialLikeCounts }));

      // After fetching, filter out videos where profiles.deactivated is true
      const filtered = (data || []).filter(v => !v.profiles?.deactivated);
      setVideos(filtered);
      await checkFollowStatus(filtered);
      await checkLikeStatus(filtered);
      await checkViewCounts(filtered);
      await checkSavedStatus(filtered);
    } catch (error) {
      console.error('Error in fetchVideos:', error);
      setError('Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const toggleMute = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (video) {
      video.muted = !isMuted[videoId];
      setIsMuted(prev => ({ ...prev, [videoId]: !isMuted[videoId] }));
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
        // Decrement counts atomically - removed due to type issues
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

  const addFollowFields = (videosArr) =>
    videosArr.map((v) => ({
      ...v,
      is_following: v.is_following ?? false,
      follower_count: v.follower_count ?? 0,
    }));

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

  // Like handling functions
  const handleLike = async (videoId: string) => {
    if (!user) return;

    try {
      console.log('Handling like for video:', videoId, 'Current status:', likeStatus[videoId]);

      // Optimistically update UI first for better user experience
      const currentLikeStatus = likeStatus[videoId] || false;
      const currentLikeCount = likeCounts[videoId] || 0;

      // Update like status immediately (optimistic update)
      setLikeStatus(prev => ({
        ...prev,
        [videoId]: !currentLikeStatus
      }));

      // Update like count immediately (optimistic update)
      setLikeCounts(prev => ({
        ...prev,
        [videoId]: currentLikeStatus ? Math.max(0, currentLikeCount - 1) : currentLikeCount + 1
      }));

      // Call the toggle_video_like function
      const { data, error } = await supabase.rpc('toggle_video_like' as any, {
        video_uuid: videoId
      });

      if (error) {
        console.error('Error toggling like:', error);
        // Revert optimistic update on error
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

      console.log('Like toggled, now liked:', data);

      // The realtime subscription will handle updates from other users
      // Our optimistic update already handled the UI for this user

    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const checkLikeStatus = async (videosArr: any[]) => {
    if (!user) return;

    try {
      const videoIds = videosArr.map(video => video.id);
      if (videoIds.length === 0) return;

      console.log('Checking like status for user:', user.id, 'videos:', videoIds);

      // Don't update like counts here - they're handled by the videos channel
      // This prevents overriding the like counts from the realtime subscription

      // Then check which videos the user has liked - one by one to avoid filter issues
      const likedVideoIds = new Set<string>();

      // Process videos in batches to avoid too many parallel requests
      const batchSize = 5;
      for (let i = 0; i < videoIds.length; i += batchSize) {
        const batch = videoIds.slice(i, i + batchSize);

        await Promise.all(batch.map(async (videoId) => {
          try {
            // Use direct query instead of RPC function since it might not be available
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

      console.log('Likes query result - liked videos:', Array.from(likedVideoIds));

      // Update like status
      const newLikeStatus: { [key: string]: boolean } = {};

      videosArr.forEach(video => {
        newLikeStatus[video.id] = likedVideoIds.has(video.id);
      });

      console.log('Like status check:', { newLikeStatus, likedVideoIds: Array.from(likedVideoIds) });

      // Update like status
      setLikeStatus(prev => ({ ...prev, ...newLikeStatus }));

    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  // View count functions
  const checkViewCounts = async (videosArr: any[]) => {
    try {
      const newViewCounts: { [key: string]: number } = {};

      videosArr.forEach(video => {
        newViewCounts[video.id] = video.view_count || 0;
      });

      setViewCounts(prev => ({ ...prev, ...newViewCounts }));

    } catch (error) {
      console.error('Error checking view counts:', error);
    }
  };

  const onViewRecorded = (videoId: string) => {
    // Update view count when a view is recorded
    setViewCounts(prev => ({
      ...prev,
      [videoId]: (prev[videoId] || 0) + 1
    }));
  };

  // Format view count for display
  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  const checkSavedStatus = async (videosArr: any[]) => {
    if (!user || videosArr.length === 0) return;
    try {
      const videoIds = videosArr.map(video => video.id);
      const { data: saved } = await supabase
        .from('saved_videos')
        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds);
      const savedVideoIds = new Set(saved?.map(row => row.video_id) || []);
      const newSavedStatus: { [key: string]: boolean } = {};
      videosArr.forEach(video => {
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
        await supabase
          .from('saved_videos')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
        setSavedStatus(prev => ({ ...prev, [videoId]: false }));
        // Optionally show toast
      } else {
        await supabase
          .from('saved_videos')
          .insert({ user_id: user.id, video_id: videoId });
        setSavedStatus(prev => ({ ...prev, [videoId]: true }));
        // Optionally show toast
      }
    } catch (error) {
      // Optionally show error toast
    }
  };


  // Helper to render clickable hashtags
  function renderDescriptionWithHashtags(description: string) {
    return description.split(/(#[\w-]+)/g).map((part, idx) => {
      if (/^#[\w-]+$/.test(part)) {
        return (
          <button
            key={idx}
            className="text-lime-400 hover:underline font-semibold"
            onClick={e => {
              e.stopPropagation();
              setActiveHashtag(part.substring(1));
            }}
          >
            {part}
          </button>
        );
      }
      return part;
    });
  }

  // Back button for filtered views
  const showBackButton = activeHashtag || (activeCategory && activeCategory !== "All");

  function Term(arg0: string) {
    throw new Error("Function not implemented.");
  }

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
            Limey
          </span>
          <div className="flex items-center space-x-2">
            {/* Search Icon Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch((v) => !v)}
              aria-label="Search"
              className="text-white hover:bg-white/10"
            >
              <SearchIcon size={20} />
            </Button>
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
        {/* Search Overlay */}
        {showSearch && (
          <>
            <form onSubmit={handleSearch} className="flex flex-col gap-2 mt-4 mb-2">
              <div className="flex items-center gap-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="flex-1 p-2 border rounded text-base bg-black/50 text-white border-white/20 placeholder-white/50"
                  placeholder="Search videos by title or hashtags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="default"
                  size="icon"
                  aria-label="Go"
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <SearchIcon size={18} />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchTerm('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);Term('');
                    setSearchResults(null);
                  }}
                  aria-label="Close"
                  className="text-white hover:bg-white/10"
                >
                  <CloseIcon size={18} />
                </Button>
              </div>
              
              {/* Category carousel */}
              <div className="overflow-x-auto pb-2 -mx-2 px-2">
                <div className="flex space-x-2">
                  {/* All button */}
                  <Button
                    key="all"
                    variant="outline"
                    size="sm"
                    className={`whitespace-nowrap bg-black border-white text-white hover:bg-black/80 ${
                      activeCategory === "All" ? 'border-lime-400 text-lime-400' : 'border-white/50'
                    }`}
                    onClick={() => {
                      setActiveCategory("All");
                      setActiveHashtag(null);
                      setSearchResults(null);
                    }}
                  >
                    All Videos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant="outline"
                      size="sm"
                      className={`whitespace-nowrap bg-black border-white text-white hover:bg-black/80 ${
                        activeCategory === category ? 'border-lime-400 text-lime-400' : 'border-white/50'
                      }`}
                      onClick={() => {
                        setActiveCategory(category);
                        setActiveHashtag(null);
                        setSearchResults(null);
                      }}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </form>
            {/* Back Button below search form when search is open */}
            {showBackButton && (
              <div className="flex justify-start mb-2">
                <Button
                  variant="ghost"
                  className="bg-black/70 text-white rounded-full px-4 py-2 flex items-center gap-2 shadow-lg hover:bg-black/80 border-none"
                  onClick={() => {
                    setActiveHashtag(null);
                    setActiveCategory("All");
                  }}
                >
                  <ArrowLeft size={20} className="text-white" />
                  <span className="font-semibold">All Videos</span>
                </Button>
              </div>
            )}
          </>
        )}
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

      {/* Back Button for filtered feed (only show if not searching) */}
      {showBackButton && !showSearch && (
        <div className="fixed top-16 left-4 z-50">
          <Button
            variant="ghost"
            className="bg-black/70 text-white rounded-full px-4 py-2 flex items-center gap-2 shadow-lg hover:bg-black/80 border-none"
            onClick={() => {
              setActiveHashtag(null);
              setActiveCategory("All");
            }}
          >
            <ArrowLeft size={20} className="text-white" />
            <span className="font-semibold">All Videos</span>
          </Button>
        </div>
      )}

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
            <Button onClick={fetchVideos} variant="outline" className="text-white border-white/20 hover:bg-white/10">
              Try Again
            </Button>
          </div>
        ) : searchResults !== null ? (
          searchLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">No results found</h3>
              <p className="text-white/70 mb-4">Try searching with different keywords or hashtags</p>
              <Button
                onClick={() => {
                  setShowSearch(false);
                  setSearchTerm('');
                  setSearchResults(null);
                }}
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
              >
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="space-y-0">
              {searchResults.map((video) => (
                <div key={video.id} className="relative h-screen snap-start snap-always flex items-center justify-center">  {/* Black space for top menu */}
                  <div className="absolute top-0 left-0 right-0 h-16 bg-black z-10"></div>

                  {/* Video container with fixed height - stops above the text area */}
                  <div className="absolute inset-0 top-16 bottom-32 overflow-hidden">
                    {/* Video */}
                    <AutoPlayVideo
                      src={video.video_url}
                      className="w-full h-full object-cover"
                      globalMuted={globalMuted}
                      videoId={video.id}
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
                        {/* Title and description without user profile */}

                        {/* Caption */}
                        <div className="space-y-2">
                          <h3 className="text-white font-semibold text-base leading-tight">{video.title}</h3>
                          {video.description && (
                            <p className="text-white/90 text-sm leading-relaxed">
                              {renderDescriptionWithHashtags(video.description)}
                            </p>
                          )}
                          {/* Category badge removed */}
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
                                className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:bg-green-700 transition-colors"
                                data-control
                              >
                                {followStatus[video.user_id] ? (
                                  <span className="text-white font-bold text-xs">✓</span>
                                ) : (
                                  <Plus size={8} className="text-white" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

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
                          <span className="text-white text-xs mt-1 font-medium">
                            {likeCounts[video.id] || 0}
                          </span>
                        </div>

                        {/* View Count */}
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Eye size={24} className="text-white" />
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
                            {savedStatus[video.id] ? <BookmarkCheck size={24} className="text-green-400" /> : <Bookmark size={24} className="text-white" />}
                          </Button>
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
          )
        ) : (
          videos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📹</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">No videos yet</h3>
              <p className="text-white/70 mb-4">
                {activeCategory === "All"
                  ? "Be the first to upload a video!"
                  : `No videos found in the "${activeCategory}" category`}
              </p>
              <Button
                onClick={() => navigate('/upload')}
                variant="default"
                className="bg-white text-black hover:bg-white/90"
              >
                Upload Your First Video
              </Button>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
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
                >  {/* Black space for top menu */}
                  <div className="absolute top-0 left-0 right-0 h-16 bg-black z-10"></div>

                  {/* Video container with fixed height - stops above the text area */}
                  <div className="absolute inset-0 top-16 bottom-32 overflow-hidden">
                    {/* Video */}
                    <AutoPlayVideo
                      src={video.video_url}
                      className="w-full h-full object-cover"
                      globalMuted={globalMuted}
                      videoId={video.id}
                      onViewRecorded={onViewRecorded}
                    />
                  </div>

                  {/* Separator line */}
                  <div className="absolute bottom-32 left-0 right-0 h-[1px] bg-white/20 z-10"></div>

                  {/* Text area with black background */}
                  <div className="absolute bottom-16 left-0 right-0 h-16 bg-black z-10"></div>

                  {/* Black space for bottom navigation */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-black z-10"></div>

                  {/* Overlay UI - positioned in the text area */}
                  <div className="absolute bottom-16 left-0 right-0 p-4 text-white z-20">
                    <div className="flex justify-between items-end">
                      {/* Left - User info & caption */}
                      <div className="flex-1 mr-4 space-y-3">
                        {/* Title and description without user profile */}

                        {/* Caption */}
                        <div className="space-y-2">
                          <h3 className="text-white font-semibold text-base leading-tight">{video.title}</h3>
                          {video.description && (
                            <p className="text-white/90 text-sm leading-relaxed">
                              {renderDescriptionWithHashtags(video.description)}
                            </p>
                          )}
                          {/* Category badge removed */}
                        </div>
                      </div>

                      {/* Actions */}
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
                                className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:bg-green-700 transition-colors"
                                data-control
                              >
                                {followStatus[video.user_id] ? (
                                  <span className="text-white font-bold text-xs">✓</span>
                                ) : (
                                  <Plus size={8} className="text-white" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

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
                          <span className="text-white text-xs mt-1 font-medium">
                            {likeCounts[video.id] || 0}
                          </span>
                        </div>

                        {/* View Count */}
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Eye size={24} className="text-white" />
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
                            {savedStatus[video.id] ? <BookmarkCheck size={24} className="text-green-400" /> : <Bookmark size={24} className="text-white" />}
                          </Button>
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
          )
        )}
      </div>
      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Feed;




