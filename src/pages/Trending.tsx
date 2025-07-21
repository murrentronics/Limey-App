import { useNavigate } from "react-router-dom";
import ModalVerticalFeed from "@/components/ModalVerticalFeed";
import AutoPlayVideo from "@/components/AutoPlayVideo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Search as SearchIcon, X as CloseIcon, MessageCircle, Share2, Play, Volume2, VolumeX, Plus, Pause, MessageSquare, TrendingUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const Trending = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const handleSearch = async () => {
    setSearchLoading(true);
    // Example: search by title
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, video_url, thumbnail_url, duration, user_id, profiles(username, avatar_url)')
      .ilike('title', `%${searchTerm}%`)
      .order('created_at', { ascending: false });
    setSearchResults(data || []);
    setSearchLoading(false);
  };

  const VIDEOS_PER_PAGE = 25;

  const fetchTrending = async (pageNum: number = 0, append: boolean = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const { data, error } = await supabase
      .from('videos')
      .select('id, title, video_url, thumbnail_url, duration, user_id, profiles(username, avatar_url, deactivated)')
      .order('created_at', { ascending: false })
      .range(pageNum * VIDEOS_PER_PAGE, (pageNum + 1) * VIDEOS_PER_PAGE - 1);
    
    const filtered = (data || []).filter(v => !v.profiles?.deactivated);
    if (append) {
      setTrendingVideos(prev => [...prev, ...filtered]);
    } else {
      setTrendingVideos(filtered);
    }
    setHasMore(data?.length === VIDEOS_PER_PAGE);
    
    setLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTrending(nextPage, true);
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold text-primary">🔥 Trending</h1>
    <div className="flex items-center space-x-2">
    <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch((v) => !v)}
              aria-label="Search"
              className="text-white hover:bg-white/10"
            >
              <SearchIcon size={20} />
            </Button>
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
      <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} aria-label="Settings">
        <Settings size={20} />
      </Button>
      
    </div>
  </div>
</div>
{showSearch && (
  <div className="p-4 flex items-center gap-2">
    <input
      ref={searchInputRef}
      type="text"
      className="flex-1 border rounded px-3 py-2 text-black bg-white placeholder-gray-500"
   placeholder="Search trending videos..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") {
          // Trigger search
          handleSearch();
        }
      }}
      autoFocus
    />
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setShowSearch(false);
        setSearchTerm("");
        setSearchResults(null);
      }}
      aria-label="Close Search"
    >
      <CloseIcon size={20} />
    </Button>
  </div>
)}

      {/* Trending Videos */}
      <div className="grid grid-cols-3 gap-4">
  {(showSearch && searchResults ? searchResults : trendingVideos).map((video, index) => (
    <Card
      key={video.id}
      className="relative aspect-[9/16] cursor-pointer group overflow-hidden bg-black/10"
      onClick={() => {
        setModalIndex(index);
        setShowModal(true);
      }}
    >
      {/* Top left: Creator avatar */}
      <div className="absolute top-2 left-2 z-10">
        <Avatar className="w-8 h-8 border-2 border-white shadow">
          <AvatarImage src={video.profiles?.avatar_url || undefined} alt={video.profiles?.username || video.user_id} />
          <AvatarFallback>{(video.profiles?.username || video.user_id)?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
      {/* Video thumbnail or video preview */}
      <div className="w-full h-full">
        <AutoPlayVideo
          src={video.video_url}
          className="w-full h-full object-cover"
          globalMuted={true}
        />
      </div>

      {/* Bottom right: Duration */}
      <div className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-1 text-xs text-white">
        {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '0:00'}
      </div>
      {/* Title overlay (optional, can be removed for cleaner look) */}
      {/* <div className="absolute bottom-10 left-2 right-2 bg-gradient-to-t from-black/60 to-transparent p-1 rounded">
        <h3 className="font-semibold text-white text-xs line-clamp-2">{video.title}</h3>
      </div> */}
    </Card>
  ))}
</div>
{showModal && modalIndex !== null && (
  <ModalVerticalFeed
    videos={trendingVideos}
    startIndex={modalIndex}
    onClose={() => setShowModal(false)}
  />
)}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Trending;