import React, { useState, useEffect } from 'react';
import { X, Copy, Mail, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoData;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, video }) => {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const videoUrl = `${window.location.origin}/video/${video.id}`;
  const username = video.profiles?.username || video.username || 'user';
  const shareText = video.description 
    ? `${video.description}\n\nBy @${username} on Limey`
    : `Check out this amazing video by @${username} on Limey!`;

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: '💬',
      color: 'bg-green-500',
      action: () => {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${video.title}\n\n${shareText}\n\n${videoUrl}`)}`;
        window.open(whatsappUrl, '_blank');
      }
    },
    {
      name: 'Facebook',
      icon: '📘',
      color: 'bg-blue-600',
      action: () => {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoUrl)}&quote=${encodeURIComponent(shareText)}`;
        window.open(facebookUrl, '_blank');
      }
    },
    {
      name: 'Instagram',
      icon: '📷',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      action: () => {
        // Instagram doesn't support direct URL sharing, so copy to clipboard
        copyToClipboard();
        toast({
          title: "Link copied!",
          description: "Paste this link in your Instagram story or bio",
        });
      }
    },
    {
      name: 'Twitter',
      icon: '🐦',
      color: 'bg-blue-400',
      action: () => {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(videoUrl)}`;
        window.open(twitterUrl, '_blank');
      }
    },
    {
      name: 'Email',
      icon: '📧',
      color: 'bg-gray-600',
      action: () => {
        const emailUrl = `mailto:?subject=${encodeURIComponent(video.title)}&body=${encodeURIComponent(`${shareText}\n\n${videoUrl}`)}`;
        window.open(emailUrl, '_blank');
      }
    },
    {
      name: 'SMS',
      icon: '💬',
      color: 'bg-green-600',
      action: () => {
        const smsUrl = `sms:?body=${encodeURIComponent(`${video.title}\n\n${shareText}\n\n${videoUrl}`)}`;
        window.open(smsUrl, '_blank');
      }
    },
    {
      name: 'Telegram',
      icon: '✈️',
      color: 'bg-blue-500',
      action: () => {
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(shareText)}`;
        window.open(telegramUrl, '_blank');
      }
    },
    {
      name: 'LinkedIn',
      icon: '💼',
      color: 'bg-blue-700',
      action: () => {
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(videoUrl)}`;
        window.open(linkedinUrl, '_blank');
      }
    }
  ];

  const copyToClipboard = async () => {
    const shareContent = `${video.title}\n\n${shareText}\n\n${videoUrl}`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareContent);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      toast({
        title: "Link copied!",
        description: "Video link copied to clipboard",
      });
      onClose();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: "Copy failed",
        description: "Unable to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: shareText,
          url: videoUrl
        });
        onClose();
      }
    } catch (error) {
      console.log('Native sharing cancelled or failed');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full max-w-md mx-4 mb-4 bg-white rounded-t-3xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Share video</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-gray-100"
          >
            <X size={20} className="text-gray-500" />
          </Button>
        </div>

        {/* Video preview */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url.startsWith('http') 
                    ? video.thumbnail_url 
                    : supabase.storage.from('limeytt-uploads').getPublicUrl(video.thumbnail_url).data.publicUrl
                  }
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                  <Share2 size={16} className="text-gray-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">{video.title}</h4>
              <p className="text-sm text-gray-500">@{username}</p>
            </div>
          </div>
        </div>

        {/* Share options */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {shareOptions.map((option) => (
              <button
                key={option.name}
                onClick={option.action}
                className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center text-white text-xl shadow-lg`}>
                  {option.icon}
                </div>
                <span className="text-xs text-gray-600 font-medium">{option.name}</span>
              </button>
            ))}
          </div>

          {/* Additional options */}
          <div className="space-y-3">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Copy size={18} className="text-gray-600" />
              </div>
              <span className="text-gray-900 font-medium">Copy link</span>
            </button>

            {navigator.share && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <ExternalLink size={18} className="text-gray-600" />
                </div>
                <span className="text-gray-900 font-medium">More options</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;