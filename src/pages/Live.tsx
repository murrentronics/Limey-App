import { Navigation } from "@/components/Navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Live = () => {
  const [user, setUser] = useState<User | null>(null);
  const [liveStreams, setLiveStreams] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Fetch live streams
    fetchLiveStreams();
  }, []);

  const fetchLiveStreams = async () => {
    try {
      const { data, error } = await supabase
        .from('live_streams')
        .select(`
          *,
          profiles!live_streams_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLiveStreams(data || []);
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-8 pb-20 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            🔴 Live
          </h1>
          <Button 
            variant="default" 
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Go Live
          </Button>
        </div>

        {liveStreams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📺</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Live Streams</h3>
            <p className="text-muted-foreground">Be the first to go live!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveStreams.map((stream) => (
              <div key={stream.id} className="bg-card rounded-lg overflow-hidden border border-border">
                <div className="aspect-video bg-gradient-to-br from-red-500 to-pink-500 relative">
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
                    🔴 LIVE
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    {stream.viewer_count} viewers
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-foreground mb-1">{stream.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{stream.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary"></div>
                    <span className="text-sm text-foreground">
                      {stream.profiles?.display_name || stream.profiles?.username}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Navigation currentUser={user} />
    </div>
  );
};

export default Live;