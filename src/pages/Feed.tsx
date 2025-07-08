import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Search as SearchIcon, X as CloseIcon, Heart, MessageCircle, Share2, Play, Volume2, VolumeX, Plus, Pause, MessageSquare } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const Feed = () => {
  const [activeCategory, setActiveCategory] = useState("All");
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
  const [isLiked, setIsLiked] = useState<{ [key: string]: boolean }>({});
  const [followStatus, setFollowStatus] = useState<{ [key: string]: boolean }>({});
  const [globalMuted, setGlobalMuted] = useState(false);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { user } = useAuth();

  const categories = [
    "All", "Soca", "Dancehall", "Carnival", "Comedy", "Dance", "Music", "Local News"
  ];

  const currentVideos = searchResults !== null ? searchResults : videos;

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
    console.log("Feed - fetching videos for category:", activeCategory);
    fetchVideos();
  }, [activeCategory]);

  // Focus search input when shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Auto-play video when it becomes visible - TikTok style
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.getAttribute('data-video-id');
          if (!videoId) return;

          if (entry.isIntersecting) {
            // Pause all other videos first
            Object.keys(videoRefs.current).forEach((id) => {
              if (id !== videoId && videoRefs.current[id]) {
                videoRefs.current[id]?.pause();
                setIsPlaying(prev => ({ ...prev, [id]: false }));
              }
            });

            // Play the video that's now visible
            const video = videoRefs.current[videoId];
            if (video && !isPlaying[videoId]) {
              // Ensure video is muted for autoplay
              video.muted = true;
              video.currentTime = 0;

              video.play().then(() => {
                setIsPlaying(prev => ({ ...prev, [videoId]: true }));
                // Unmute after successful play if globalMuted is false
                if (!globalMuted) {
                  video.muted = false;
                }
              }).catch((error) => {
                console.log('Autoplay failed for video:', videoId, error);
              });
            }
          } else {
            // Pause the video that's no longer visible
            const video = videoRefs.current[videoId];
            if (video && isPlaying[videoId]) {
              video.pause();
              video.currentTime = 0;
              setIsPlaying(prev => ({ ...prev, [videoId]: false }));
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe all video containers
    const videoContainers = document.querySelectorAll('[data-video-id]');
    videoContainers.forEach(container => observer.observe(container));

    return () => observer.disconnect();
  }, [videos, searchResults, isPlaying, globalMuted]);

  // Play first video when videos load
  useEffect(() => {
    if (videos.length > 0 && !loading) {
      setTimeout(() => {
        const firstVideoId = videos[0].id;
        const video = videoRefs.current[firstVideoId];
        if (video) {
          // Pause all
          Object.keys(videoRefs.current).forEach((id) => {
            if (id !== firstVideoId && videoRefs.current[id]) {
              videoRefs.current[id]?.pause();
              setIsPlaying(prev => ({ ...prev, [id]: false }));
            }
          });
          // Play the first video
          video.currentTime = 0;
          // Start muted for autoplay
          video.muted = true;

          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(prev => ({ ...prev, [firstVideoId]: true }));
                if (!globalMuted) {
                  video.muted = false;
                }
              })
              .catch(() => {
                // autoplay failed, keep muted
                setIsPlaying(prev => ({ ...prev, [firstVideoId]: true }));
              });
          }
        }
      }, 100);
    }
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
      .limit(50);

    if (searchTerm.startsWith('#')) {
      const tag = searchTerm.replace('#', '').toLowerCase();
      query = query.ilike('description', `%#${tag}%`);
    } else {
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`);
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
      } else {
        fallbackQuery = fallbackQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`);
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
        .select(`*, profiles!inner(username, avatar_url)`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeCategory !== "All") {
        query = query.eq('category', activeCategory);
      }
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching videos with profiles:', error);
        // fallback without profiles
        let fallbackQuery = supabase
          .from('videos')
          .select(`*`)
          .order('created_at', { ascending: false })
          .limit(50);
        if (activeCategory !== "All") {
          fallbackQuery = fallbackQuery.eq('category', activeCategory);
        }
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) {
          console.error('Error fetching videos without profiles:', fallbackError);
          setError('Failed to load videos. Please try again.');
          return;
        }
        if (fallbackData && fallbackData.length > 0) {
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
          setVideos(videosWithProfiles);
          await checkFollowStatus(videosWithProfiles);
        } else {
          setVideos(fallbackData || []);
          await checkFollowStatus(fallbackData || []);
        }
      } else {
        setVideos(data || []);
        await checkFollowStatus(data || []);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError('Failed to load videos. Please try again.');
    } finally {
      console.log("Feed - fetchVideos completed, loading set to false");
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (count?: number) => {
    if (!count) return "0";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handleVideoRef = (videoId: string, element: HTMLVideoElement | null) => {
    videoRefs.current[videoId] = element;
  };

  const togglePlay = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;
    if (isPlaying[videoId]) {
      // Pause the video
      video.pause();
    } else {
      // Pause all others
      Object.keys(videoRefs.current).forEach(id => {
        if (id !== videoId && videoRefs.current[id]) {
          videoRefs.current[id]?.pause();
        }
      });
      // Play this video
      video.play().catch(e => {
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

  const handleLike = async (videoId: string) => {
    // Toggle like state
    setIsLiked(prev => ({ ...prev, [videoId]: !isLiked[videoId] }));
    // TODO: Implement actual like functionality with database
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

  const getUsername = (video: any) => {
    if (video.profiles?.username) return video.profiles.username;
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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
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
            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchVideos}
              disabled={loading}
              aria-label="Refresh"
              className="text-white hover:bg-white/10"
            >
              <div className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
            </Button>
            {/* Messenger Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/inbox')}
              className="text-white hover:bg-white/10"
            >
              <MessageSquare size={16} />
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
          <form onSubmit={handleSearch} className="flex items-center gap-2 mt-4 mb-2">
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 p-2 border rounded text-base bg-black/50 text-white border-white/20 placeholder-white/50"
              placeholder="Search hashtags, titles, categories..."
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
                setSearchResults(null);
              }}
              aria-label="Close"
              className="text-white hover:bg-white/10"
            >
              <CloseIcon size={18} />
            </Button>
          </form>
        )}
      </div>

      {/* Global Mute Toggle */}
      <div className="fixed top-20 right-4 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleGlobalMute}
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
                <div
                  key={video.id}
                  data-video-id={video.id}
                  className="relative h-screen snap-start snap-always flex items-center justify-center"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const isControlButton = target.closest('button') || target.closest('[data-control]');
                    if (!isControlButton) togglePlay(video.id);
                  }}
                >
                  {/* Video */}
                  <video
                    ref={(el) => (videoRefs.current[video.id] = el)}
                    src={video.video_url}
                    className="w-full h-full object-cover"
                    loop
                    muted={globalMuted}
                    playsInline
                      onPlay={() => setIsPlaying(prev => ({ ...prev, [video.id]: true }))}
                      onPause={() => setIsPlaying(prev => ({ ...prev, [video.id]: false }))}
                  />

                  {/* Video Info Overlay */}
                  <div className="absolute bottom-20 left-0 right-0 p-6 text-white">
                    <div className="flex justify-between items-end">
                      {/* Left - User info & caption */}
                      <div className="flex-1 mr-4 space-y-3">
                        {/* User Profile */}
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={video.profiles?.avatar_url || undefined} alt={getUsername(video)} />
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

                      {/* Right actions */}
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

                  {/* Play/Pause overlay */}
                  {!isPlaying[video.id] && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Button
                        variant="ghost"
                        className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay(video.id);
                        }}
                        data-control
                      >
                        <Play size={32} className="ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // No search results, show videos or no videos
          <div className="space-y-0">
            {videos.length === 0 ? (
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
                {videos.map((video) => (
                  <div
                    key={video.id}
                    data-video-id={video.id}
                    className="relative h-screen snap-start snap-always flex items-center justify-center"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const isControlButton = target.closest('button') || target.closest('[data-control]');
                      if (!isControlButton) togglePlay(video.id);
                    }}
                  >
                    {/* Video */}
                    <video
                      ref={(el) => (videoRefs.current[video.id] = el)}
                      src={video.video_url}
                      className="w-full h-full object-cover"
                      loop
                      muted={globalMuted}
                      playsInline
                      onPlay={() => setIsPlaying(prev => ({ ...prev, [video.id]: true }))}
                      onPause={() => setIsPlaying(prev => ({ ...prev, [video.id]: false }))}
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
                                <AvatarImage src={video.profiles?.avatar_url || undefined} alt={getUsername(video)} />
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

                    {/* Play overlay */}
                    {!isPlaying[video.id] && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Button
                          variant="ghost"
                          className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white pointer-events-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlay(video.id);
                          }}
                          data-control
                        >
                          <Play size={32} className="ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Feed;