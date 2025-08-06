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
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          video.play();
        } else {
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

  // Simple view recording with less frequent checks
  useEffect(() => {
    if (!videoId || !user || viewRecorded) return;

    const video = videoRef.current;
    if (!video) return;

    let viewTimer: NodeJS.Timeout;

    const handlePlay = () => {
      if (!viewRecorded) {
        viewTimer = setTimeout(() => {
          if (!viewRecorded && video.currentTime >= 3) {
            setViewRecorded(true);
            supabase.rpc('record_video_view', { video_uuid: videoId })
              .then(({ data }) => {
                if (data && onViewRecorded) {
                  onViewRecorded(videoId);
                }
              });
          }
        }, 3000);
      }
    };

    const handlePause = () => {
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, [videoId, user, viewRecorded, onViewRecorded]);

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      muted={globalMuted}
      playsInline
      controls={false}
      preload="metadata"
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