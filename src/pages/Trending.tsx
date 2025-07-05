import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";

const Trending = () => {
  // Mock trending data with higher view counts
  const trendingVideos = [
    {
      id: 1,
      creator: "CarnivalKing_2024",
      title: "Road March Champion! 🏆",
      views: "2.1M",
      duration: "1:30",
      thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop",
      isLive: false,
      trending: "#1"
    },
    {
      id: 2,
      creator: "SocaVibes",
      title: "VIRAL Dance Challenge 🔥",
      views: "1.8M",
      duration: "0:15",
      thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=600&fit=crop",
      isLive: false,
      trending: "#2"
    },
    {
      id: 3,
      creator: "TriniComedy",
      title: "When Your Mom Calls... 😂",
      views: "1.2M",
      duration: "0:45",
      thumbnail: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=600&fit=crop",
      isLive: false,
      trending: "#3"
    },
    {
      id: 4,
      creator: "LocalFoodie",
      title: "Making Doubles at 3AM",
      views: "890K",
      duration: "2:00",
      thumbnail: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop",
      isLive: false,
      trending: "#4"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">🔥 Trending</h1>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">Filter</Button>
          </div>
        </div>
      </div>

      {/* Trending Videos */}
      <div className="p-4">
        <div className="space-y-4">
          {trendingVideos.map((video, index) => (
            <Card 
              key={video.id} 
              className="flex items-center space-x-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => {
                console.log("Trending video clicked:", video.title);
                // Navigate to video player
              }}
            >
              <div className="flex-shrink-0">
                <Badge variant="secondary" className="text-xs font-bold">
                  {video.trending}
                </Badge>
              </div>
              
              <div className="relative w-16 h-20 rounded-lg overflow-hidden">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <Badge variant="secondary" className="absolute bottom-1 right-1 text-xs bg-black/70 text-white">
                  {video.duration}
                </Badge>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1">
                  {video.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{video.creator}</span>
                  <span>{video.views} views</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Trending;