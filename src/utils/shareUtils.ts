import { supabase } from "@/integrations/supabase/client";

interface VideoData {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  user_id: string;
  username?: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  };
}

export const shareVideo = async (video: VideoData) => {
  const videoUrl = `${window.location.origin}/video/${video.id}`;
  const username = video.profiles?.username || video.username || 'user';
  
  // Prepare share data with rich metadata
  const shareData = {
    title: video.title,
    text: video.description 
      ? `${video.description}\n\nBy @${username} on Limey`
      : `Check out this amazing video by @${username} on Limey!`,
    url: videoUrl
  };

  try {
    // Try native sharing first (mobile devices)
    if (navigator.share) {
      // Check if canShare is available and the data is shareable
      if (!navigator.canShare || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    }
  } catch (error) {
    console.log('Native sharing failed, falling back to clipboard:', error);
  }

  // Fallback: copy to clipboard with formatted text
  try {
    const shareText = `${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`;
    
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);
      console.log('Link copied to clipboard!');
      return true;
    } else {
      // Fallback for older browsers or non-HTTPS contexts
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log('Link copied to clipboard (fallback)!');
          return true;
        } else {
          console.error('Failed to copy using execCommand');
          return false;
        }
      } catch (err) {
        document.body.removeChild(textArea);
        console.error('execCommand copy failed:', err);
        return false;
      }
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

// Generate Open Graph meta tags for the video share page
export const generateVideoMetaTags = (video: VideoData, viewCount: number = 0) => {
  const videoUrl = `${window.location.origin}/video/${video.id}`;
  const username = video.profiles?.username || video.username || 'user';
  const thumbnailUrl = video.thumbnail_url 
    ? (video.thumbnail_url.startsWith('http') 
        ? video.thumbnail_url 
        : supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl)
    : `${window.location.origin}/default-thumbnail.png`;

  return {
    title: `${video.title} | Limey`,
    description: video.description || `Watch this amazing video by @${username} on Limey`,
    image: thumbnailUrl,
    url: videoUrl,
    type: 'video.other',
    site_name: 'Limey',
    creator: `@${username}`,
    video_url: video.video_url,
    video_type: 'video/mp4'
  };
};

// Format view count for display
export const formatViews = (count: number) => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
  return (count / 1000000).toFixed(1) + 'M';
};

// Get video thumbnail URL
export const getVideoThumbnailUrl = (thumbnailUrl?: string) => {
  if (!thumbnailUrl) return null;
  
  return thumbnailUrl.startsWith('http')
    ? thumbnailUrl
    : supabase.storage.from('limeytt-uploads').getPublicUrl(thumbnailUrl).data.publicUrl;
};