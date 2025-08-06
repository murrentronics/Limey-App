import React, { useRef, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AutoPlayVideoProps {
  src: string;
  className?: string;
  globalMuted?: boolean;
  videoId?: string;
  user?: any;
  onViewRecorded?: (videoId: string) => void;
  [key: string]: any;
}

const AutoPlayVideo: React.FC<AutoPlayVideoProps> = ({
  src,
  className,
  globalMuted = false,
  videoId,
  user,
  onViewRecorded,
  ...props
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    video.muted = globalMuted;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          setIsVisible(true);
          video.play().catch(error => {

          });
        } else {
          setIsVisible(false);
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);

    return () => {
      observer.unobserve(video);
    };
  }, [globalMuted]);

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
              console.log('AutoPlayVideo: New view successfully recorded for video:', videoId);
              // Only update UI if it was a new view
              if (onViewRecorded) {
                onViewRecorded(videoId);
              }
            } else {
              console.log('AutoPlayVideo: View already exists for video:', videoId, '- not recording duplicate');
            }
          } else {
            console.error('AutoPlayVideo: Error recording view:', error);
          }
        } catch (error) {
          console.error('AutoPlayVideo: Exception recording view:', error);
        }
      }, 5000); // 5 seconds delay

      return () => {
        console.log('AutoPlayVideo: Clearing view timer for video:', videoId);
        clearTimeout(timer);
      };
    }
  }, [isVisible, isPlaying, viewRecorded, videoId, onViewRecorded]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={src}
        loop
        muted={globalMuted}
        playsInline
        controls={false}
        preload="none"
        poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAwMDAiLz48L3N2Zz4="
        className={className}
        style={{
          pointerEvents: 'auto',
          backgroundColor: '#000000',
          objectFit: 'cover'
        }}

        {...props}
      />
      <style>{`
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-enclosure {
          display: none !important;
        }
        video::-webkit-media-controls-panel {
          display: none !important;
        }
        video::-webkit-media-controls-play-button {
          display: none !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
        }
      `}</style>
      {isVisible && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              videoRef.current?.play();
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

export default AutoPlayVideo;