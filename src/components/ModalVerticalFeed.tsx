import AutoPlayVideo from "@/components/AutoPlayVideo"; // or the correct path to your AutoPlayVideo component
import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";

const ModalVerticalFeed = ({ videos, startIndex, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the selected video when modal opens
    if (containerRef.current) {
      const child = containerRef.current.children[startIndex] as HTMLElement;
      if (child) child.scrollIntoView({ behavior: "auto" });
    }
  }, [startIndex]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <button
        className="absolute top-4 right-4 z-50 text-white bg-black/60 rounded-full p-2"
        onClick={onClose}
      >
        <X size={32} />
      </button>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {videos.map((video, idx) => (
          <div
            key={video.id}
            className="h-screen flex items-center justify-center snap-start"
            style={{ scrollSnapAlign: "start" }}
          >
            <AutoPlayVideo
              src={video.video_url}
              className="w-full h-full object-cover"
              globalMuted={false}
              videoId={video.id}
              creatorId={video.user_id}
              onViewRecorded={() => {}}
            />
            {/* Add overlay UI/info as needed */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModalVerticalFeed;