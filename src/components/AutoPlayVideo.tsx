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

  // Simple view recording without complex state tracking
  useEffect(() => {
    if (!videoId || !user || viewRecorded) return;

    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= 3 && !viewRecorded) {
        setViewRecorded(true);
        supabase.rpc('record_video_view', { video_uuid: videoId })
          .then(({ data }) => {
            if (data && onViewRecorded) {
              onViewRecorded(videoId);
            }
          });
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
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