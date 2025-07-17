import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";

export const verifyPassword = async (userId: string, password) => {
  const { data: userPassword, error: userPasswordError } = await supabase
    .from('user_passwords')
    .select('password')
    .eq('user_id', userId)
    .single();

  if (userPasswordError || !userPassword) {
    return false;
  }

  const passwordMatches = await bcrypt.compare(password, userPassword.password);

  return passwordMatches;
};
