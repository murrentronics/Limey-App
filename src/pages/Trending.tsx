import { Navigation } from "@/components/Navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { VideoCard } from "@/components/VideoCard";

const Trending = () => {
  const [user, setUser] = useState<User | null>(null);
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    
    fetchTrendingVideos();
  }, []);

  const fetchTrendingVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          profiles!videos_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .order('view_count', { ascending: false })
        .order('like_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTrendingVideos(data || []);
    } catch (error) {
      console.error('Error fetching trending videos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-center px-4 py-3">
          <h1 className="text-2xl font-bold text-primary">🔥 Trending</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pt-16 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary animate-pulse"></div>
          </div>
        ) : trendingVideos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">🔥</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Trending Videos Yet</h3>
            <p className="text-muted-foreground">Be the first to create viral content!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {trendingVideos.map((video, index) => (
              <div key={video.id} className="relative">
                {index === 0 && (
                  <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    #1 TRENDING
                  </div>
                )}
                {index < 3 && index > 0 && (
                  <div className="absolute top-4 left-4 z-10 bg-gray-800/80 text-white px-3 py-1 rounded-full text-sm font-bold">
                    #{index + 1}
                  </div>
                )}
                <VideoCard
                  video={{
                    id: video.id,
                    title: video.title,
                    description: video.description,
                    video_url: video.video_url,
                    thumbnail_url: video.thumbnail_url,
                    like_count: video.like_count || 0,
                    view_count: video.view_count || 0,
                    comment_count: video.comment_count || 0,
                    category: video.category,
                    user_id: video.user_id,
                    created_at: video.created_at,
                    profiles: video.profiles
                  }}
                  onVideoUpdate={fetchTrendingVideos}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation currentUser={user} />
    </div>
  );
};

export default Trending;