-- Add phone verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code TEXT,
ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP WITH TIME ZONE;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

-- Create index for verification code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_verification_code ON public.profiles(verification_code) WHERE verification_code IS NOT NULL;

-- Add unique constraint for usernames (if not already exists)
DO $$ 
BEGIN
    -- Check if unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_username_key' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;

-- Create function to check username availability
CREATE OR REPLACE FUNCTION public.is_username_available(username_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE LOWER(username) = LOWER(username_to_check)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon;

-- Create function to validate Trinidad phone numbers
CREATE OR REPLACE FUNCTION public.is_valid_trinidad_phone(phone_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove any spaces, dashes, or parentheses
    phone_to_check := regexp_replace(phone_to_check, '[^0-9]', '', 'g');
    
    -- Check if it starts with 1868 and has 11 digits total
    RETURN phone_to_check ~ '^1868[0-9]{7}$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_valid_trinidad_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_trinidad_phone(TEXT) TO anon;

-- Update the handle_new_user function to not auto-verify phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    FALSE -- Phone not verified by default
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;