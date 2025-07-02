import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VideoCardProps {
  video: {
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
  };
  onVideoUpdate: () => void;
}

export const VideoCard = ({ video, onVideoUpdate }: VideoCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.like_count);
  const { toast } = useToast();

  const handleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to like videos",
          variant: "destructive"
        });
        return;
      }

      if (isLiked) {
        // Unlike
        await supabase
          .from('video_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', video.id);
        
        setLikeCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        // Like
        await supabase
          .from('video_likes')
          .insert({
            user_id: user.id,
            video_id: video.id
          });
        
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error liking video:', error);
      toast({
        title: "Error",
        description: "Failed to like video",
        variant: "destructive"
      });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: video.title,
        text: video.description,
        url: window.location.href
      });
    }
  };

  return (
    <div className="relative w-full h-screen video-item bg-card">
      {/* Video Background */}
      <div className="absolute inset-0">
        {video.video_url ? (
          <video
            className="w-full h-full object-cover"
            loop
            muted
            autoPlay
            playsInline
            poster={video.thumbnail_url}
          >
            <source src={video.video_url} type="video/mp4" />
          </video>
        ) : (
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${video.thumbnail_url})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Video Actions (Right Side) */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center space-y-4">
        {/* Profile Avatar */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center border-2 border-white">
            {video.profiles?.avatar_url ? (
              <img 
                src={video.profiles.avatar_url} 
                alt={video.profiles.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-primary-foreground font-bold">
                {video.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
        </div>

        {/* Like Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40"
          onClick={handleLike}
        >
          <Heart className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </Button>
        <span className="text-white text-sm font-semibold">{likeCount}</span>

        {/* Comment Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
        <span className="text-white text-sm font-semibold">{video.comment_count}</span>

        {/* Share Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40"
          onClick={handleShare}
        >
          <Share2 className="h-6 w-6 text-white" />
        </Button>

        {/* Gift Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40"
        >
          <Gift className="h-6 w-6 text-white" />
        </Button>
      </div>

      {/* Video Info (Bottom Left) */}
      <div className="absolute left-4 bottom-32 right-20">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-white font-semibold">
              @{video.profiles?.username || 'unknown'}
            </span>
            {video.profiles?.trini_credits && (
              <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold">
                {video.profiles.trini_credits} TC
              </span>
            )}
          </div>
          <h3 className="text-white font-semibold text-lg">{video.title}</h3>
          {video.description && (
            <p className="text-white/90 text-sm">{video.description}</p>
          )}
          <div className="flex items-center space-x-4 text-white/70 text-sm">
            <span>{video.view_count} views</span>
            <span>#{video.category}</span>
          </div>
        </div>
      </div>
    </div>
  );
};