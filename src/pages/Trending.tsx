import { Navigation } from "@/components/Navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Trending = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-8 pb-20 px-4">
        <h1 className="text-2xl font-bold text-primary mb-4">🔥 Trending</h1>
        <p className="text-muted-foreground">Trending videos coming soon!</p>
      </div>
      <Navigation currentUser={user} />
    </div>
  );
};

export default Trending;