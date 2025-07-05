-- Fix function search_path security warnings
-- Update all functions to have proper search_path settings

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_user_profile(user_id bigint)
RETURNS TABLE(id bigint, username text, email text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    RETURN QUERY SELECT p.id, p.username, p.email FROM public.profiles p WHERE p.id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_profile(user_id bigint, new_username text, new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    UPDATE public.profiles SET username = new_username, email = new_email WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_active_users()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    active_count bigint;
BEGIN
    SELECT COUNT(*) INTO active_count FROM public.profiles WHERE is_creator = true;
    RETURN active_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_posts()
RETURNS TABLE(id bigint, title text, content text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    RETURN QUERY SELECT v.id::bigint, v.title, v.description FROM public.videos v;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_posts(keyword text)
RETURNS TABLE(id bigint, title text, content text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    RETURN QUERY SELECT v.id::bigint, v.title, v.description FROM public.videos v 
    WHERE v.title ILIKE '%' || keyword || '%' OR v.description ILIKE '%' || keyword || '%';
END;
$$;