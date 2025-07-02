import { useState, useEffect } from "react";
import { VideoFeed } from "@/components/VideoFeed";
import { Navigation } from "@/components/Navigation";
import { CategoryTabs } from "@/components/CategoryTabs";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Home = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleVideoUploaded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Category Tabs */}
      <CategoryTabs 
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onVideoUploaded={handleVideoUploaded}
      />
      
      {/* Video Feed */}
      <VideoFeed 
        category={selectedCategory} 
        key={refreshKey}
      />
      
      {/* Bottom Navigation */}
      <Navigation currentUser={user} />
    </div>
  );
};

export default Home;