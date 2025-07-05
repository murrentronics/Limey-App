import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";

const Live = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  
  const categories = ["All", "Music", "Dance", "Comedy", "Gaming", "Talk"];

  const liveStreams = [
    {
      id: 1,
      creator: "CarnivalLive",
      title: "LIVE: Mas Band Rehearsal 🎭",
      viewers: "2.3K",
      thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop",
      category: "Music"
    },
    {
      id: 2,
      creator: "SocaDJ",
      title: "Power Soca Mix 2024 🔥",
      viewers: "1.8K",
      thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=600&fit=crop",
      category: "Music"
    },
    {
      id: 3,
      creator: "TriniChef",
      title: "Cooking Pelau LIVE!",
      viewers: "956",
      thumbnail: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop",
      category: "Talk"
    },
    {
      id: 4,
      creator: "DanceStudio",
      title: "Soca Dance Class 💃",
      viewers: "743",
      thumbnail: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=600&fit=crop",
      category: "Dance"
    }
  ];

  const filteredStreams = activeCategory === "All" 
    ? liveStreams 
    : liveStreams.filter(stream => stream.category === activeCategory);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">🔴 Live</h1>
          <div className="flex items-center space-x-2">
            <Button variant="neon" size="sm">Go Live</Button>
          </div>
        </div>
        
        {/* Category Pills */}
        <div className="flex overflow-x-auto space-x-2 mt-4 pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category)}
              className="whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Live Streams */}
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStreams.map((stream) => (
            <Card 
              key={stream.id} 
              className="relative group cursor-pointer"
              onClick={() => {
                console.log("Live stream clicked:", stream.title);
                // Navigate to live stream
              }}
            >
              <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden">
                <img 
                  src={stream.thumbnail} 
                  alt={stream.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* LIVE badge */}
                <div className="absolute top-2 left-2">
                  <Badge className="bg-red-600 text-white animate-pulse">
                    🔴 LIVE
                  </Badge>
                </div>
                
                {/* Viewer count */}
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="bg-black/70 text-white">
                    {stream.viewers} watching
                  </Badge>
                </div>
                
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">▶</span>
                  </div>
                </div>
              </div>
              
              {/* Stream Info */}
              <div className="p-3">
                <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1">
                  {stream.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{stream.creator}</span>
                  <Badge variant="outline" className="text-xs">
                    {stream.category}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredStreams.length === 0 && (
          <div className="text-center mt-12">
            <p className="text-muted-foreground">No live streams in this category</p>
            <Button variant="neon" className="mt-4">Start Streaming</Button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Live;