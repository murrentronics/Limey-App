import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Search as SearchIcon, X as CloseIcon, Share2, Play, Volume2, VolumeX, Plus, Pause, TrendingUp, ArrowLeft, Heart, Eye, Bookmark, BookmarkCheck, MessageCircle, Video, ExternalLink, X } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import ShareModal from "@/components/ShareModal";
import CommentsModal from "@/components/CommentsModal";
import { trackAdImpression, trackAdClick } from "@/lib/adminUtils";
import React from "react";

// Define interfaces for better type safety
interface VideoData {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  category?: string;
  user_id: string;
  username?: string;
  created_at: string;
  like_count?: number;
  view_count?: number;
  share_count?: number;
  save_count?: number;
  comment_count?: number;
  duration?: number;
  tags?: string[];
  profiles?: {
    username?: string;
    avatar_url?: string;
    deactivated?: boolean;
    user_id?: string;
  };
  avatar_url?: string;
  is_following?: boolean;
  follower_count?: number;
  // Add any other properties that might be returned from Supabase
  [key: string]: any; // This allows for additional properties
}

interface SponsoredAdData {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration: number;
  business_name?: string;
  contact_number?: string;
  website_url?: string;
  support_email?: string;
  price_info?: string;
  impressions: number;
  clicks: number;
  isSponsored: true; // Flag to identify sponsored content
}

// --- AutoPlayVideo component ---
interface AutoPlayVideoProps {
  src: string;
  className?: string;
  globalMuted: boolean;
  videoId: string;
  user?: any;
  onViewRecorded?: (videoId: string) => void;
  [key: string]: any;
}

const AutoPlayVideo: React.FC<AutoPlayVideoProps> = ({ src, className, globalMuted, videoId, user, onViewRecorded, ...props }) => {
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);
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

    // Always start muted to allow autoplay
    video.muted = true;
    
    // More aggressive preloading for better performance
    video.preload = 'metadata';

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          setIsVisible(true);
          // Try to play the video
          video.play().catch(error => {
            // Video will remain paused until user interaction
          });
        } else {
          setIsVisible(false);
          video.pause();
          video.currentTime = 0;
        }
      },
      { 
        threshold: [0, 0.1, 0.3, 0.5],
        rootMargin: '100px 0px 100px 0px' // Start loading 100px before entering viewport
      }
    );
    observer.observe(video);
    
    // Preload video metadata immediately
    video.load();

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
          // Use the RPC function to record the view
          const { data, error } = await supabase.rpc('record_video_view', {
            video_uuid: videoId
          });

          if (!error) {
            // Always mark as viewed to prevent repeated attempts
            setViewRecorded(true);

            if (data) {
              // Only update UI if it was a new view
              if (onViewRecorded) {
                onViewRecorded(videoId);
              }
            }
          }
        } catch (error) {
          // Silently handle view recording errors
        }
      }, 5000); // 5 seconds delay

      return () => {
        clearTimeout(timer);
      };
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
        preload="metadata"
        poster=""
        className={className}
        style={{ backgroundColor: '#000000' }}
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

// Note: VideoData interface is already defined above

const Feed = () => {
  const location = useLocation();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<VideoData[] | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState<Record<string, boolean>>({});
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({});
  const [likeStatus, setLikeStatus] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [globalMuted, setGlobalMuted] = useState<boolean>(false);
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [showCommentsModal, setShowCommentsModal] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareVideo, setShareVideo] = useState<VideoData | null>(null);
  const [sponsoredAds, setSponsoredAds] = useState<SponsoredAdData[]>([]);
  const [showAdModal, setShowAdModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<SponsoredAdData | null>(null);
  const [adCountdowns, setAdCountdowns] = useState<Record<string, number>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { user } = useAuth();

  // Add fire animation styles for trending button
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const categories = [
    "Anime", "Bar Limes", "Cartoon", "Carnival", "Comedy", "Dance", "Dancehall",
    "DIY Projects", "Educational", "Events", "Fete", "Funny Vids", "HOW TOs",
    "Local News", "Music Vids", "Parties", "Soca", "Trini Celebs"
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

    fetchVideos();
  }, [activeCategory]);

  // Handle shared video auto-scroll
  useEffect(() => {
    const videoId = searchParams.get('video');
    if (videoId && videos.length > 0) {


      // Find the video index
      const videoIndex = videos.findIndex(v => v.id === videoId);
      if (videoIndex !== -1) {
        // Scroll to the video
        setTimeout(() => {
          const videoElement = document.querySelector(`[data-video-id="${videoId}"]`);
          if (videoElement) {
            videoElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentVideoIndex(videoIndex);
          }
        }, 500);

        // Clear the video parameter from URL
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.delete('video');
          return newParams;
        });
      }
    }
  }, [videos, searchParams, setSearchParams]);



  // Focus search input when shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Function to fetch latest profile data for videos
  const fetchLatestProfileData = async (videosList: VideoData[]) => {
    if (!videosList || videosList.length === 0) return;

    try {
      // Get unique user IDs from videos
      const userIds = [...new Set(videosList.map(video => video.user_id))];

      // Fetch latest profile data for these users
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      if (error) {
        // Silently handle profile data fetch errors
        return;
      }

      if (profilesData && profilesData.length > 0) {
        // Create a map of user_id to profile data
        const profilesMap = new Map();
        profilesData.forEach(p => profilesMap.set(p.user_id, p));

        // Update videos with latest profile data
        const updatedVideos = videosList.map(video => {
          const latestProfile = profilesMap.get(video.user_id);
          if (latestProfile) {
            return {
              ...video,
              profiles: {
                ...video.profiles,
                username: latestProfile.username,
                avatar_url: latestProfile.avatar_url
              },
              avatar_url: latestProfile.avatar_url
            };
          }
          return video;
        });

        // Update state with latest profile data
        if (searchResults !== null) {
          setSearchResults(updatedVideos);
        } else {
          setVideos(updatedVideos);
        }
      }
    } catch (error) {
      // Silently handle fetchLatestProfileData errors
    }
  };

  // Subscribe to profile changes
  useEffect(() => {
    if (!user) return;

    // Subscribe to profiles table changes
    const profilesChannel = supabase
      .channel('profiles_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles'
      }, (payload) => {

        // Fetch latest profile data for all videos
        if (searchResults !== null) {
          fetchLatestProfileData(searchResults);
        } else {
          fetchLatestProfileData(videos);
        }
      })
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, [user, videos, searchResults]);

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
        try {
          if (payload.new && payload.new.id) {
            const videoId = payload.new.id;
            const newLikeCount = payload.new.like_count || 0;
            const newShareCount = payload.new.share_count || 0;
            const newSaveCount = payload.new.save_count || 0;

            // Update counts based on the payload
            setLikeCounts(prev => ({
              ...prev,
              [videoId]: newLikeCount
            }));

            setShareCounts(prev => ({
              ...prev,
              [videoId]: newShareCount
            }));

            setSaveCounts(prev => ({
              ...prev,
              [videoId]: newSaveCount
            }));
          }
        } catch (error) {
          console.error('Unexpected error in videos realtime handler:', error);
        }
      })
      .subscribe();

    // Subscribe to video_likes table for direct like status updates
    const likesChannel = supabase
      .channel('likes_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_likes'
      }, async (payload) => {
        try {
          if (payload.eventType === 'INSERT' && payload.new?.user_id === user.id) {
            setLikeStatus(prev => ({
              ...prev,
              [payload.new.video_id]: true
            }));
          } else if (payload.eventType === 'DELETE') {
            if (payload.old && payload.old.video_id) {
              const videoId = payload.old.video_id;
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
      }, async (payload) => {
        const newView = payload.new;

        if (newView && newView.video_id) {
          try {
            const { data: genuineCount, error } = await supabase.rpc('get_genuine_view_count', {
              video_uuid: newView.video_id
            });

            if (!error && typeof genuineCount === 'number') {
              setViewCounts(prev => ({
                ...prev,
                [newView.video_id]: genuineCount
              }));
            } else {
              setViewCounts(prev => {
                const newCount = (prev[newView.video_id] || 0) + 1;
                return {
                  ...prev,
                  [newView.video_id]: newCount
                };
              });
            }
          } catch (error) {
            console.error('Error getting genuine view count:', error);
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

    // Subscribe to saved_videos changes
    const savedChannel = supabase
      .channel('saved_videos_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'saved_videos'
      }, async (payload) => {
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

  // Handle comment modal from notification navigation
  useEffect(() => {
    if (location.state?.showCommentsForVideo && videos.length > 0) {
      const videoId = location.state.showCommentsForVideo;
      setShowCommentsModal(videoId);
      
      // Clear the state to prevent reopening on subsequent renders
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, videos, navigate, location.pathname]);

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
      // Silently handle search errors
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
        // Silently handle fallback search errors
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
        await fetchLatestProfileData(videosWithProfiles); // Fetch latest profile data
      } else {
        setSearchResults([]);
      }
    } else {
      setSearchResults((data as VideoData[]) || []);
      // Also check like status for search results
      await checkLikeStatus((data as VideoData[]) || []);
      await checkSavedStatus((data as VideoData[]) || []);
      await fetchLatestProfileData((data as VideoData[]) || []); // Fetch latest profile data
    }
    setSearchLoading(false);
  };

  // Fetch active sponsored ads
  const fetchSponsoredAds = async (): Promise<SponsoredAdData[]> => {
    try {
      const { data, error } = await supabase.rpc('get_active_sponsored_ads');

      if (error) {
        // Silently handle sponsored ads fetch errors
        return [];
      }

      const ads = (data || []).map((ad: any) => ({
        ...ad,
        isSponsored: true
      }));

      return ads;
    } catch (error) {
      // Silently handle sponsored ads fetch errors
      return [];
    }
  };

  // Smart algorithm to merge sponsored ads with regular videos
  const mergeVideosWithAds = (videos: VideoData[], ads: SponsoredAdData[]): (VideoData | SponsoredAdData)[] => {

    if (ads.length === 0) {
      return videos;
    }

    const merged: (VideoData | SponsoredAdData)[] = [];
    let adIndex = 0;

    // Insert ads every 3-5 videos for better visibility
    const getNextAdPosition = () => Math.floor(Math.random() * 3) + 3; // Random between 3-5
    let nextAdPosition = getNextAdPosition();

    videos.forEach((video, index) => {
      merged.push(video);

      // Insert ad at intervals, but only in home feed (All category)
      if (activeCategory === "All" &&
        index >= nextAdPosition &&
        adIndex < ads.length) {
        merged.push(ads[adIndex]);
        adIndex++;
        nextAdPosition = index + getNextAdPosition();
      }
    });

    // If we still have ads left and we're in the "All" category, add them at the end
    if (activeCategory === "All" && adIndex < ads.length) {
      while (adIndex < ads.length) {
        merged.push(ads[adIndex]);
        adIndex++;
      }
    }
    return merged;
  };

  // Initialize countdown for sponsored ads
  const initializeAdCountdown = (ad: SponsoredAdData) => {
    if (adCountdowns[ad.id]) return; // Already initialized

    const duration = ad.duration || 30;
    setAdCountdowns(prev => ({ ...prev, [ad.id]: duration }));

    const interval = setInterval(() => {
      setAdCountdowns(prev => {
        const newCount = (prev[ad.id] || 0) - 1;
        if (newCount <= 0) {
          clearInterval(interval);
          return { ...prev, [ad.id]: 0 };
        }
        return { ...prev, [ad.id]: newCount };
      });
    }, 1000);
  };

  // Handle Learn More click
  const handleLearnMoreClick = async (ad: SponsoredAdData) => {
    await trackAdClick(ad.id, user?.id);
    setSelectedAd(ad);
    setShowAdModal(true);
  };

  // Track ad impression when video starts playing
  const trackAdView = async (ad: SponsoredAdData, viewDuration: number = 0) => {
    await trackAdImpression(ad.id, user?.id, viewDuration);
  };

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('videos')
        .select(`*, like_count, view_count, share_count, save_count`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (activeCategory !== "All") {
        query = query.eq('category', activeCategory);
      }
      const { data, error } = await query;

      if (error) {
        // Handle video fetch errors
        setError('Failed to load videos. Please try again.');
        return;
      }

      // Initialize counts from the fetched data
      const initialLikeCounts = {};
      const initialShareCounts = {};
      const initialSaveCounts = {};
      const initialCommentCounts = {};
      data?.forEach(video => {
        initialLikeCounts[video.id] = video.like_count || 0;
        initialShareCounts[video.id] = video.share_count || 0;
        initialSaveCounts[video.id] = video.save_count || 0;
        // Set comment count to 0 for now since the column doesn't exist yet
        initialCommentCounts[video.id] = 0;
      });

      // Update counts immediately
      setLikeCounts(prev => ({ ...prev, ...initialLikeCounts }));
      setShareCounts(prev => ({ ...prev, ...initialShareCounts }));
      setSaveCounts(prev => ({ ...prev, ...initialSaveCounts }));
      setCommentCounts(prev => ({ ...prev, ...initialCommentCounts }));

      // After fetching, filter out videos where profiles.deactivated is true//
      const filtered = (data || []).filter(v => {
        // Check if profiles exists and if deactivated is true
        const profileData = v as unknown as { profiles?: { deactivated?: boolean } };
        return !profileData.profiles?.deactivated;
      });
      // Fetch sponsored ads and merge with regular videos
      const ads = await fetchSponsoredAds();
      setSponsoredAds(ads);

      const mergedContent = mergeVideosWithAds(filtered as VideoData[], ads);
      setVideos(mergedContent as VideoData[]);

      await checkFollowStatus(filtered as VideoData[]);
      await checkLikeStatus(filtered as VideoData[]);
      await checkViewCounts(filtered as VideoData[]);
      await checkSavedStatus(filtered as VideoData[]);
      await checkCommentCounts(filtered as VideoData[]);
      await fetchLatestProfileData(filtered as VideoData[]); // Fetch latest profile data
    } catch (error) {
      // Handle fetchVideos errors
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
    } else {
      // Pause ALL other videos first
      Object.keys(videoRefs.current).forEach(id => {
        if (id !== videoId && videoRefs.current[id]) {
          const otherVideo = videoRefs.current[id];
          if (!otherVideo.paused) {
            otherVideo.pause();
            otherVideo.currentTime = 0;
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
      }).catch(e => {
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



  const handleShare = (video: VideoData) => {
    setShareVideo(video);
    setShareModalOpen(true);
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
          // Handle follow errors
        }
        return false;
      }
    } catch (error) {
      // Handle follow/unfollow errors
      return followStatus[targetUserId] || false;
    }
  };

  const getUsername = (video: VideoData) => {
    // Use direct username field from videos table
    if (video.username) return video.username;
    if (video.user_id) {
      const userId = video.user_id.replace(/[^a-zA-Z0-9]/g, "");
      return `user_${userId.slice(0, 8)}`;
    }
    return 'unknown_user';
  };

  const getProfileUrl = (video: VideoData) => {
    const username = getUsername(video);
    if (user && video.user_id === user.id) {
      return '/profile';
    }
    return `/profile/${username}`;
  };

  const addFollowFields = (videosArr: VideoData[]): VideoData[] =>
    videosArr.map((v) => ({
      ...v,
      is_following: v.is_following ?? false,
      follower_count: v.follower_count ?? 0,
    }));

  const checkFollowStatus = async (videosArr: VideoData[]) => {
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
      // Handle follow status check errors
    }
  };

  // Like handling functions
  const handleLike = async (videoId: string) => {
    if (!user) return;

    try {

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
        // Handle like toggle errors
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

      // The realtime subscription will handle updates from other users
      // Our optimistic update already handled the UI for this user

    } catch (error) {
      // Handle like errors
    }
  };

  const checkLikeStatus = async (videosArr: VideoData[]) => {
    if (!user) return;

    try {
      const videoIds = videosArr.map(video => video.id);
      if (videoIds.length === 0) return;

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
            // Handle individual like check errors
          }
        }));
      }


      // Update like status
      const newLikeStatus: { [key: string]: boolean } = {};

      videosArr.forEach(video => {
        newLikeStatus[video.id] = likedVideoIds.has(video.id);
      });

      // Update like status
      setLikeStatus(prev => ({ ...prev, ...newLikeStatus }));

    } catch (error) {
      // Handle like status check errors
    }
  };

  // View count functions
  const checkViewCounts = async (videosArr: VideoData[]) => {
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
          // Handle view count errors
          newViewCounts[video.id] = video.view_count || 0;
        }
      }

      setViewCounts(prev => ({ ...prev, ...newViewCounts }));

    } catch (error) {
      console.error('Error checking view counts:', error);
    }
  };

  // Comment count functions
  const checkCommentCounts = async (videosArr: VideoData[]) => {
    try {
      const newCommentCounts: { [key: string]: number } = {};

      // Try to get comment counts from the database
      for (const video of videosArr) {
        try {
          const { count, error } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', video.id)
            .is('parent_id', null); // Only count top-level comments

          if (!error && typeof count === 'number') {
            newCommentCounts[video.id] = count;
          } else {
            // Fallback to 0 if comments table doesn't exist yet
            newCommentCounts[video.id] = 0;
          }
        } catch (err) {
          // Handle comment count errors (table might not exist yet)
          newCommentCounts[video.id] = 0;
        }
      }

      setCommentCounts(prev => ({ ...prev, ...newCommentCounts }));

    } catch (error) {
      console.error('Error checking comment counts:', error);
      // Set all comment counts to 0 if there's an error
      const fallbackCounts: { [key: string]: number } = {};
      videosArr.forEach(video => {
        fallbackCounts[video.id] = 0;
      });
      setCommentCounts(prev => ({ ...prev, ...fallbackCounts }));
    }
  };

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

  const checkSavedStatus = async (videosArr: VideoData[]) => {
    if (!user || videosArr.length === 0) return;
    try {
      const videoIds = videosArr.map(video => video.id);

      // Define a type for saved videos
      interface SavedVideo {
        video_id: string;
      }

      // Use type assertion to tell TypeScript that 'saved_videos' is a valid table
      // and specify the expected response structure
      const response = await (supabase
        .from('saved_videos' as any)

        .select('video_id')
        .eq('user_id', user.id)
        .in('video_id', videoIds));

      // Extract the data from the response with proper type assertion
      const saved = (response.data as unknown as SavedVideo[]) || [];

      // Create a Set of saved video IDs with explicit typing
      const savedVideoIds = new Set<string>(saved.map(row => row.video_id));

      // Create a new status object
      const newSavedStatus: Record<string, boolean> = {};

      // Set saved status for each video
      videosArr.forEach(video => {
        if (video && video.id) {
          newSavedStatus[video.id] = savedVideoIds.has(video.id);
        }
      });

      // Update state with the new saved statuses
      setSavedStatus(newSavedStatus);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };
  const handleSave = async (videoId: string) => {
    if (!user) return;
    try {
      // Define interfaces for Supabase responses
      interface DeleteResponse {
        error: any;
      }

      interface InsertResponse {
        error: any;
      }

      if (savedStatus[videoId]) {
        // Delete the saved video with proper type assertion
        const { error: deleteError } = await (supabase
          .from('saved_videos' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId)) as DeleteResponse;

        if (deleteError) throw deleteError;

        // Update state optimistically
        setSavedStatus(prev => ({ ...prev, [videoId]: false }));
        // Optionally show toast
      } else {
        // Insert new saved video with proper type assertion
        const { error: insertError } = await (supabase
          .from('saved_videos' as any)
          .insert({
            user_id: user.id,
            video_id: videoId
          })) as InsertResponse;

        if (insertError) throw insertError;

        // Update state optimistically
        setSavedStatus(prev => ({ ...prev, [videoId]: true }));
        // Optionally show toast
      }
    } catch (error) {
      console.error('Error saving/unsaving video:', error);
      // Revert optimistic update if there was an error
      setSavedStatus(prev => ({ ...prev, [videoId]: !prev[videoId] }));
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
                    className={`whitespace-nowrap bg-black border-white text-white hover:bg-black/80 hover:text-lime-400 ${activeCategory === "All" ? 'border-lime-400 text-lime-400' : 'border-white/50'
                      }`}
                    onClick={() => {
                      setActiveCategory("All");
                      setActiveHashtag(null);
                      setSearchResults(null);
                    }}
                  >
                    All
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant="outline"
                      size="sm"
                      className={`whitespace-nowrap bg-black border-white text-white hover:bg-black/80 hover:text-lime-400 ${activeCategory === category ? 'border-lime-400 text-lime-400' : 'border-white/50'
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
                <Video size={32} className="text-white/70" />
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
                <div key={video.id} data-video-id={video.id} className="relative h-screen snap-start snap-always flex items-center justify-center">  {/* Black space for top menu */}
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

                        {/* Comment Button */}
                        <div className="flex flex-col items-center">
                          <button
                            onClick={e => { 
                              e.stopPropagation(); 
                              setShowCommentsModal(video.id);
                            }}
                            className="p-0 bg-transparent border-none"
                            data-control
                          >
                            <MessageCircle
                              size={28}
                              className="text-white fill-white transition-colors"
                            />
                          </button>
                          <span className="text-white text-xs mt-1 font-medium">
                            {commentCounts[video.id] || 0}
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
          )
        ) : (
          videos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video size={32} className="text-white/70" />
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
              {filteredVideos.map((video) => {
                const isSponsored = (video as any).isSponsored;
                const sponsoredAd = isSponsored ? (video as unknown as SponsoredAdData) : null;

                return (
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
                          // Track ad view if it's a sponsored ad
                          if (sponsoredAd) {
                            trackAdView(sponsoredAd);
                            initializeAdCountdown(sponsoredAd);
                          }
                        } else {
                          videoElement.pause();
                        }
                      }
                    }}
                  >
                    {/* Black space for top menu */}
                    <div className="absolute top-0 left-0 right-0 h-16 bg-black z-10"></div>

                    {/* Sponsored Banner for ads */}
                    {isSponsored && (
                      <div className="absolute top-20 left-4 right-4 z-20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-yellow-600 text-black font-bold">
                            SPONSORED
                          </Badge>
                          <div className="bg-black/70 px-2 py-1 rounded text-white text-sm">
                            {adCountdowns[video.id] || sponsoredAd?.duration || 30}s
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white/90 text-black hover:bg-white border-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (sponsoredAd) handleLearnMoreClick(sponsoredAd);
                          }}
                          data-control
                        >
                          <ExternalLink size={14} className="mr-1" />
                          Learn More
                        </Button>
                      </div>
                    )}

                    {/* Video container with fixed height - stops above the text area */}
                    <div className="absolute inset-0 top-16 bottom-32 overflow-hidden">
                      {/* Video */}
                      <AutoPlayVideo
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        globalMuted={globalMuted}
                        videoId={video.id}
                        user={user}
                        onViewRecorded={isSponsored ? undefined : onViewRecorded}
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

                        {/* Actions - Hidden for sponsored ads */}
                        {!isSponsored && (
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

                            {/* Comment Button */}
                            <div className="flex flex-col items-center">
                              <button
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  setShowCommentsModal(video.id);
                                }}
                                className="p-0 bg-transparent border-none"
                                data-control
                              >
                                <MessageCircle
                                  size={28}
                                  className="text-white fill-white transition-colors"
                                />
                              </button>
                              <span className="text-white text-xs mt-1 font-medium">
                                {commentCounts[video.id] || 0}
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
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Ad Details Modal */}
      {selectedAd && (
        <div className={`fixed inset-0 z-50 ${showAdModal ? 'block' : 'hidden'}`}>
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowAdModal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-white">Business Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdModal(false)}
                  className="p-2"
                >
                  <X size={20} className="text-white" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{selectedAd.title}</h3>
                  {selectedAd.description && (
                    <p className="text-muted-foreground mb-4">{selectedAd.description}</p>
                  )}
                </div>

                {selectedAd.business_name && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Business Name</h4>
                    <p className="text-muted-foreground">{selectedAd.business_name}</p>
                  </div>
                )}

                {selectedAd.contact_number && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Contact Number</h4>
                    <a
                      href={`tel:${selectedAd.contact_number}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {selectedAd.contact_number}
                    </a>
                  </div>
                )}

                {selectedAd.website_url && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Website</h4>
                    <a
                      href={selectedAd.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {selectedAd.website_url}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}

                {selectedAd.support_email && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Email</h4>
                    <a
                      href={`mailto:${selectedAd.support_email}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {selectedAd.support_email}
                    </a>
                  </div>
                )}

                {selectedAd.price_info && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Pricing</h4>
                    <p className="text-muted-foreground">{selectedAd.price_info}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    This is a sponsored advertisement
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Comments Modal */}
      {showCommentsModal && (
        <CommentsModal
          isOpen={!!showCommentsModal}
          onClose={() => setShowCommentsModal(null)}
          videoId={showCommentsModal}
          videoTitle={videos.find(v => v.id === showCommentsModal)?.title}
          onCommentCountChange={(videoId, newCount) => {
            setCommentCounts(prev => ({ ...prev, [videoId]: newCount }));
          }}
        />
      )}
    </div>
  );
};

export default Feed;
