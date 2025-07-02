import { useState, useEffect } from "react";
import { VideoCard } from "@/components/VideoCard";
import { supabase } from "@/integrations/supabase/client";

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  category: string;
  user_id: string;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    trini_credits: number;
  } | null;
}

interface VideoFeedProps {
  category: string;
}

export const VideoFeed = ({ category }: VideoFeedProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, [category]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      // First get videos
      let videoQuery = supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (category !== "All") {
        videoQuery = videoQuery.eq('category', category.toLowerCase());
      }

      const { data: videosData, error: videosError } = await videoQuery;

      if (videosError) {
        console.error('Error fetching videos:', videosError);
        return;
      }

      // Then get profiles for each video
      const videosWithProfiles = await Promise.all(
        (videosData || []).map(async (video) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url, trini_credits')
            .eq('user_id', video.user_id)
            .single();

          return {
            ...video,
            profiles: profile
          };
        })
      );

      setVideos(videosWithProfiles);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen pt-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 video-container h-screen overflow-y-auto">
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full px-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary text-2xl">🎬</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to share some Trini vibes!
            </p>
          </div>
        </div>
      ) : (
        videos.map((video) => (
          <VideoCard 
            key={video.id} 
            video={video}
            onVideoUpdate={fetchVideos}
          />
        ))
      )}
    </div>
  );
};