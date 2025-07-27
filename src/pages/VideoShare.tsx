import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Share2, Heart, Eye } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
  profiles?: {
    username?: string;
    avatar_url?: string;
  };
}

const VideoShare = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    if (videoId) {
      fetchVideo();
      // Also test if we can query videos table at all
      testVideoQuery();
    }
  }, [videoId]);

  const testVideoQuery = async () => {
    try {
      console.log('Testing video table access...');
      const { data: allVideos, error: allError } = await supabase
        .from('videos')
        .select('id, title')
        .limit(5);
      
      console.log('All videos test:', { allVideos, allError });
      
      if (allVideos && allVideos.length > 0) {
        console.log('Video table accessible. Sample videos:', allVideos);
        
        // Check if our specific video exists
        const targetVideo = allVideos.find(v => v.id === videoId);
        if (targetVideo) {
          console.log('Target video found in sample:', targetVideo);
        } else {
          console.log('Target video NOT found in sample. Checking if it exists...');
          const { data: specificVideo, error: specificError } = await supabase
            .from('videos')
            .select('id, title, user_id')
            .eq('id', videoId);
          console.log('Specific video check:', { specificVideo, specificError });
        }
      }
    } catch (err) {
      console.error('Error testing video query:', err);
    }
  };

  // Update meta tags for rich link previews
  useEffect(() => {
    if (video) {
      const { generateVideoMetaTags } = require('@/utils/shareUtils');
      const metaTags = generateVideoMetaTags(video, viewCount);
      
      // Update document title
      document.title = metaTags.title;
      
      // Update or create meta tags
      const updateMetaTag = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      const updateNameMetaTag = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      // Open Graph tags
      updateMetaTag('og:title', metaTags.title);
      updateMetaTag('og:description', metaTags.description);
      updateMetaTag('og:image', metaTags.image);
      updateMetaTag('og:url', metaTags.url);
      updateMetaTag('og:type', metaTags.type);
      updateMetaTag('og:site_name', metaTags.site_name);
      updateMetaTag('og:video', metaTags.video_url);
      updateMetaTag('og:video:type', metaTags.video_type);

      // Twitter Card tags
      updateNameMetaTag('twitter:card', 'player');
      updateNameMetaTag('twitter:title', metaTags.title);
      updateNameMetaTag('twitter:description', metaTags.description);
      updateNameMetaTag('twitter:image', metaTags.image);
      updateNameMetaTag('twitter:creator', metaTags.creator);
      updateNameMetaTag('twitter:player', metaTags.video_url);
      updateNameMetaTag('twitter:player:width', '405');
      updateNameMetaTag('twitter:player:height', '720');

      // Standard meta tags
      updateNameMetaTag('description', metaTags.description);
    }
  }, [video, viewCount]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      console.log('Fetching video with ID:', videoId);
      
      // Fetch video data - try with explicit columns first
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('id, title, description, video_url, thumbnail_url, category, user_id, created_at, like_count, view_count, username')
        .eq('id', videoId)
        .single();

      console.log('Video query result:', { videoData, videoError });

      if (videoError) {
        console.error('Error fetching video:', videoError);
        setError(`Video not found: ${videoError.message}`);
        return;
      }

      if (!videoData) {
        console.error('No video data returned');
        setError('Video not found');
        return;
      }

      console.log('Video data found:', videoData);

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', videoData.user_id)
        .single();

      console.log('Profile query result:', { profileData, profileError });

      // Get genuine view count
      try {
        const { data: genuineCount, error: viewError } = await supabase.rpc('get_genuine_view_count', {
          video_uuid: videoId
        });
        console.log('View count result:', { genuineCount, viewError });
        setViewCount(genuineCount || videoData.view_count || 0);
      } catch (viewErr) {
        console.error('Error getting view count:', viewErr);
        setViewCount(videoData.view_count || 0);
      }

      const videoWithProfile = {
        ...videoData,
        profiles: profileData,
        username: profileData?.username
      };

      console.log('Final video object:', videoWithProfile);
      setVideo(videoWithProfile);

    } catch (err) {
      console.error('Error fetching video:', err);
      setError(`Failed to load video: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchInApp = () => {
    if (user) {
      // User is logged in, redirect to feed with video ID
      navigate(`/?video=${videoId}`);
    } else {
      // User not logged in, redirect to login with return URL
      navigate(`/login?returnTo=${encodeURIComponent(`/?video=${videoId}`)}`);
    }
  };

  const handleTryInFeed = () => {
    // Try to find the video in the main feed
    navigate(`/?video=${videoId}`);
  };

  const handleShare = async () => {
    if (!video) return;
    
    const videoUrl = `${window.location.origin}/video/${video.id}`;
    try {
      await navigator.share({
        title: video.title,
        text: video.description || `Check out this video by @${video.username || 'user'}`,
        url: videoUrl
      });
    } catch (error) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(videoUrl);
    }
  };

  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="text-center max-w-md mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">Video not found</h2>
          <p className="text-white/70 mb-4">This video may have been removed or is no longer available.</p>
          {error && (
            <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">Debug info: {error}</p>
              <p className="text-red-400 text-xs mt-2">Video ID: {videoId}</p>
            </div>
          )}
          <div className="space-y-3">
            <Button onClick={handleTryInFeed} className="w-full bg-green-600 hover:bg-green-700">
              Try to Find in Feed
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
              Go to Home Feed
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 p-4">
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
          <Button
            onClick={handleShare}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <Share2 size={20} />
          </Button>
        </div>
      </div>

      {/* Video Preview */}
      <div className="pt-20 px-4">
        <div className="max-w-md mx-auto">
          {/* Video Thumbnail */}
          <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden mb-4">
            {video.thumbnail_url ? (
              <img
                src={
                  video.thumbnail_url.startsWith('http')
                    ? video.thumbnail_url
                    : supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl
                }
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <Play size={48} className="text-white/50" />
              </div>
            )}
            
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Play size={24} className="text-white ml-1" />
              </div>
            </div>

            {/* Stats overlay */}
            <div className="absolute bottom-4 left-4 flex items-center gap-4">
              <div className="flex items-center gap-1 bg-black/70 rounded-full px-2 py-1">
                <Heart size={16} className="text-white" />
                <span className="text-xs text-white font-semibold">{video.like_count || 0}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/70 rounded-full px-2 py-1">
                <Eye size={16} className="text-white" />
                <span className="text-xs text-white font-semibold">{formatViews(viewCount)}</span>
              </div>
            </div>
          </div>

          {/* Video Info */}
          <div className="space-y-4">
            {/* Creator */}
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={video.profiles?.avatar_url} alt={video.username} />
                <AvatarFallback>{(video.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">@{video.username || 'user'}</h3>
                <p className="text-sm text-white/70">Creator</p>
              </div>
            </div>

            {/* Title and Description */}
            <div>
              <h2 className="text-lg font-semibold mb-2">{video.title}</h2>
              {video.description && (
                <p className="text-white/90 text-sm leading-relaxed">{video.description}</p>
              )}
            </div>

            {/* Category */}
            {video.category && (
              <div className="inline-block bg-white/10 rounded-full px-3 py-1">
                <span className="text-sm text-white/80">{video.category}</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-8">
            <Button
              onClick={handleWatchInApp}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
              size="lg"
            >
              {user ? 'Watch in App' : 'Sign in to Watch'}
            </Button>
          </div>

          {/* App Info */}
          <div className="mt-6 text-center">
            <p className="text-white/70 text-sm">
              Join Limey to discover more amazing videos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoShare;