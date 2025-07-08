import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Trending = () => {
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { user } = useAuth();

  const VIDEOS_PER_PAGE = 25;

  const fetchTrending = async (pageNum: number = 0, append: boolean = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const { data, error } = await supabase
      .from('videos')
      .select('id, title, video_url, thumbnail_url, duration, view_count, user_id, profiles(username, avatar_url)')
      .order('view_count', { ascending: false })
      .range(pageNum * VIDEOS_PER_PAGE, (pageNum + 1) * VIDEOS_PER_PAGE - 1);
    
    if (data) {
      if (append) {
        setTrendingVideos(prev => [...prev, ...data]);
      } else {
        setTrendingVideos(data);
      }
      setHasMore(data.length === VIDEOS_PER_PAGE);
    }
    
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
            <Button variant="ghost" size="sm">Filter</Button>
          </div>
        </div>
      </div>

      {/* Trending Videos */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-4">
            {trendingVideos.map((video, index) => (
              <Card 
                key={video.id} 
                className="flex items-center space-x-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => {
                  // Navigate to video player
                }}
              >
                <div className="flex-shrink-0">
                  <Badge variant="secondary" className="text-xs font-bold">
                    #{index + 1}
                  </Badge>
                </div>
                <div className="relative w-16 h-20 rounded-lg overflow-hidden">
                  <img 
                    src={video.thumbnail_url} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <Badge variant="secondary" className="absolute bottom-1 right-1 text-xs bg-black/70 text-white">
                    {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1">
                    {video.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">{video.profiles?.username || video.user_id}</span>
                    <span>{video.view_count || 0} views</span>
                  </div>
                </div>
              </Card>
            ))}
            
            {/* View More Button */}
            {hasMore && trendingVideos.length >= VIDEOS_PER_PAGE && (
              <div className="flex justify-center mt-6">
                <Button 
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-2"
                >
                  {loadingMore ? "Loading..." : "View More"}
                </Button>
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

export default Trending;