import { supabase } from "@/integrations/supabase/client";

export const handleLike = async (videoId: string, userId: string) => {
  const { data: existingLike } = await supabase
    .from('video_likes')
    .select('*')
    .eq('video_id', videoId)
    .eq('user_id', userId)
    .single();

  if (existingLike) {
    await supabase
      .from('video_likes')
      .delete()
      .eq('video_id', videoId)
      .eq('user_id', userId);
  } else {
    await supabase
      .from('video_likes')
      .insert({
        video_id: videoId,
        user_id: userId,
      });
  }
};
