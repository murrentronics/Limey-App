import React, { useRef, useEffect, useState } from "react";
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
  const [viewRecorded, setViewRecorded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = globalMuted;

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          video.play().catch(() => {}); // Ignore play errors
        } else {
          video.pause();
          video.currentTime = 0;
        }
      },
      { 
        threshold: 0.7,
        rootMargin: '0px 0px -20% 0px' // Only trigger when more in view
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect(); // More thorough cleanup
    };
  }, [globalMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted;
    }
  }, [globalMuted]);

  // Optimized view recording - less resource intensive
  useEffect(() => {
    if (!videoId || !user || viewRecorded) return;

    const video = videoRef.current;
    if (!video) return;

    let viewTimer: NodeJS.Timeout;
    let hasStartedPlaying = false;

    const handleTimeUpdate = () => {
      if (!hasStartedPlaying && video.currentTime >= 2) {
        hasStartedPlaying = true;
        setViewRecorded(true);
        
        // Debounce the view recording
        if (viewTimer) clearTimeout(viewTimer);
        viewTimer = setTimeout(() => {
          supabase.rpc('record_video_view', { video_uuid: videoId })
            .catch(() => {}); // Ignore errors silently
        }, 1000);
        
        video.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate, { passive: true });

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, [videoId, user, viewRecorded]);

  return (
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
        backgroundColor: '#000000',
        objectFit: 'cover'
      }}
      {...props}
    />
  );
};

export default AutoPlayVideo;