import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Search as SearchIcon, X as CloseIcon, Heart, MessageCircle, Share, Play, Volume2, VolumeX } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

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
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  
  const categories = [
    "All", "Soca", "Dancehall", "Carnival", "Comedy", "Dance", "Music", "Local News"
  ];

  useEffect(() => {
    fetchVideos();
  }, [activeCategory]);

  // Focus search input when shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Auto-play video when it becomes visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.getAttribute('data-video-id');
          if (!videoId) return;
          
          if (entry.isIntersecting) {
            // Play the video that's now visible
            const video = videoRefs.current[videoId];
            if (video) {
              video.play();
              setIsPlaying(prev => ({ ...prev, [videoId]: true }));
            }
          } else {
            // Pause the video that's no longer visible
            const video = videoRefs.current[videoId];
            if (video) {
              video.pause();
              setIsPlaying(prev => ({ ...prev, [videoId]: false }));
            }
          }
        });
      },
      { threshold: 0.5 } // Trigger when 50% of video is visible
    );

    // Observe all video containers
    const videoContainers = document.querySelectorAll('[data-video-id]');
    videoContainers.forEach(container => observer.observe(container));

    return () => observer.disconnect();
  }, [videos, searchResults]);

  // Search function for hashtags, tags, categories, title, description
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    // Search for hashtags, tags, categories, title, description
    // Hashtags: #tag, tags: comma/space separated, category, title, description
    let query = supabase
      .from('videos')
      .select(`*, profiles(username, avatar_url)`)
      .order('created_at', { ascending: false })
      .limit(50); // Limit search results

    // If search term starts with #, search description/tags for hashtag
    if (searchTerm.startsWith('#')) {
      const tag = searchTerm.replace('#', '').toLowerCase();
      query = query.ilike('description', `%#${tag}%`);
    } else {
      // Otherwise, search title, description, category, tags
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,tags.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (!error) {
      setSearchResults(data || []);
    } else {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try with profiles join
      let query = supabase
        .from('videos')
        .select(`*, profiles(username, avatar_url)`)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to prevent performance issues

      // Filter by category if not "All"
      if (activeCategory !== "All") {
        query = query.eq('category', activeCategory);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching videos with profiles:', error);
        // If profiles join fails, try without it
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
        
        setVideos(fallbackData || []);
      } else {
        setVideos(data || []);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
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
    if (video) {
      if (isPlaying[videoId]) {
        video.pause();
        setIsPlaying(prev => ({ ...prev, [videoId]: false }));
      } else {
        video.play();
        setIsPlaying(prev => ({ ...prev, [videoId]: true }));
      }
    }
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
    try {
      await navigator.share({
        title: video.title,
        text: video.description,
        url: window.location.href
      });
    } catch (error) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const currentVideos = searchResults !== null ? searchResults : videos;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Limey</h1>
          <div className="flex items-center space-x-2">
            {/* Search Icon Button */}
            <Button variant="ghost" size="icon" onClick={() => setShowSearch((v) => !v)} aria-label="Search" className="text-white hover:bg-white/10">
              <SearchIcon size={20} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchVideos}
              disabled={loading}
              aria-label="Refresh"
              className="text-white hover:bg-white/10"
            >
              <div className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/upload')} className="text-white border-white/20 hover:bg-white/10">Upload</Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/settings')}
              className="text-white hover:bg-white/10"
            >
              <Settings size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-white hover:bg-white/10">Logout</Button>
          </div>
        </div>

        {/* Search Bar Overlay */}
        {showSearch && (
          <form onSubmit={handleSearch} className="flex items-center gap-2 mt-4 mb-2">
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 p-2 border rounded text-base bg-black/50 text-white border-white/20 placeholder-white/50"
              placeholder="Search hashtags, titles, categories..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Button type="submit" variant="default" size="icon" aria-label="Go" disabled={searchLoading}>
              {searchLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <SearchIcon size={18} />
              )}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => { setShowSearch(false); setSearchTerm(""); setSearchResults(null); }} aria-label="Close" className="text-white hover:bg-white/10">
              <CloseIcon size={18} />
            </Button>
          </form>
        )}
      </div>

      {/* Video Feed */}
      <div 
        ref={containerRef}
        className="pt-20 pb-24 h-screen overflow-y-auto snap-y snap-mandatory"
        style={{ scrollSnapType: 'y mandatory' }}
      >
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
        ) : (searchResults !== null ? (
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
              <p className="text-white/70 mb-4">
                Try searching with different keywords or hashtags
              </p>
              <Button onClick={() => { setShowSearch(false); setSearchTerm(""); setSearchResults(null); }} variant="outline" className="text-white border-white/20 hover:bg-white/10">
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="space-y-0">
              {searchResults.map((video, index) => (
                <div
                  key={video.id}
                  data-video-id={video.id}
                  className="relative h-screen snap-start snap-always flex items-center justify-center"
                >
                  {/* Video */}
                  <video
                    ref={(el) => handleVideoRef(video.id, el)}
                    src={video.video_url}
                    className="w-full h-full object-cover"
                    loop
                    muted={isMuted[video.id] || false}
                    playsInline
                    onPlay={() => setIsPlaying(prev => ({ ...prev, [video.id]: true }))}
                    onPause={() => setIsPlaying(prev => ({ ...prev, [video.id]: false }))}
                  />

                  {/* Video Info Overlay - TikTok Style */}
                  <div className="absolute bottom-20 left-0 right-0 p-6 text-white">
                    <div className="flex justify-between items-end">
                      {/* Left Side - User Info and Caption */}
                      <div className="flex-1 mr-4 space-y-3">
                        {/* User Profile */}
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-red-500 p-0.5">
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {(video.profiles?.username || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-lg">
                              @{video.profiles?.username || 'unknown'}
                            </p>
                          </div>
                        </div>

                        {/* Video Caption */}
                        <div className="space-y-2">
                          <h3 className="text-white font-semibold text-base leading-tight">
                            {video.title}
                          </h3>
                          {video.description && (
                            <p className="text-white/90 text-sm leading-relaxed">
                              {video.description}
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
                            onClick={() => handleLike(video.id)}
                            className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
                          >
                            <Heart 
                              size={28} 
                              className={`${isLiked[video.id] ? "fill-red-500 text-red-500" : "text-white"} transition-colors`} 
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
                            className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
                          >
                            <MessageCircle size={28} />
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
                            onClick={() => handleShare(video)}
                            className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
                          >
                            <Share size={28} />
                          </Button>
                          <span className="text-white text-xs font-semibold mt-1">
                            Share
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Play/Pause Button - Only show when paused */}
                  {!isPlaying[video.id] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        variant="ghost"
                        className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
                        onClick={() => togglePlay(video.id)}
                      >
                        <Play size={32} className="ml-1" />
                      </Button>
                    </div>
                  )}

                  {/* Mute Button */}
                  <div className="absolute top-4 right-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMute(video.id)}
                      className="text-white p-2 bg-black/30 hover:bg-black/50 rounded-full"
                    >
                      {isMuted[video.id] ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📹</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">No videos yet</h3>
            <p className="text-white/70 mb-4">
              {activeCategory === "All" 
                ? "Be the first to upload a video!" 
                : `No videos found in the "${activeCategory}" category`
              }
            </p>
            <Button onClick={() => navigate('/upload')} variant="default" className="bg-white text-black hover:bg-white/90">
              Upload Your First Video
            </Button>
          </div>
        ) : (
          <div className="space-y-0">
            {videos.map((video, index) => (
              <div
                key={video.id}
                data-video-id={video.id}
                className="relative h-screen snap-start snap-always flex items-center justify-center"
              >
                {/* Video */}
                <video
                  ref={(el) => handleVideoRef(video.id, el)}
                  src={video.video_url}
                  className="w-full h-full object-cover"
                  loop
                  muted={isMuted[video.id] || false}
                  playsInline
                  onPlay={() => setIsPlaying(prev => ({ ...prev, [video.id]: true }))}
                  onPause={() => setIsPlaying(prev => ({ ...prev, [video.id]: false }))}
                />

                {/* Video Info Overlay - TikTok Style */}
                <div className="absolute bottom-20 left-0 right-0 p-6 text-white">
                  <div className="flex justify-between items-end">
                    {/* Left Side - User Info and Caption */}
                    <div className="flex-1 mr-4 space-y-3">
                      {/* User Profile */}
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-red-500 p-0.5">
                          <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {(video.profiles?.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-white font-semibold text-lg">
                            @{video.profiles?.username || 'unknown'}
                          </p>
                        </div>
                      </div>

                      {/* Video Caption */}
                      <div className="space-y-2">
                        <h3 className="text-white font-semibold text-base leading-tight">
                          {video.title}
                        </h3>
                        {video.description && (
                          <p className="text-white/90 text-sm leading-relaxed">
                            {video.description}
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
                          onClick={() => handleLike(video.id)}
                          className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
                        >
                          <Heart 
                            size={28} 
                            className={`${isLiked[video.id] ? "fill-red-500 text-red-500" : "text-white"} transition-colors`} 
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
                          className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
                        >
                          <MessageCircle size={28} />
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
                          onClick={() => handleShare(video)}
                          className="w-12 h-12 rounded-full p-0 text-white hover:bg-white/10"
                        >
                          <Share size={28} />
                        </Button>
                        <span className="text-white text-xs font-semibold mt-1">
                          Share
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Play/Pause Button - Only show when paused */}
                {!isPlaying[video.id] && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      variant="ghost"
                      className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
                      onClick={() => togglePlay(video.id)}
                    >
                      <Play size={32} className="ml-1" />
                    </Button>
                  </div>
                )}

                {/* Mute Button */}
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMute(video.id)}
                    className="text-white p-2 bg-black/30 hover:bg-black/50 rounded-full"
                  >
                    {isMuted[video.id] ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )))}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Feed;