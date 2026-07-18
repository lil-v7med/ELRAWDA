-- =========================================================================
-- ELRAWDA Migration: 001_profiles.sql
-- Creates public.profiles table and sets up basic security.
-- =========================================================================

-- Create user profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  currency TEXT DEFAULT '$',
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  role TEXT DEFAULT 'user',
  two_factor_secret TEXT,
  is_2fa_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own profile, or admins to select all profiles
CREATE POLICY "Users can select their own profile or admins can select all" 
  ON public.profiles FOR SELECT 
  USING (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow users to update their own profile (role modification checked by trigger in 004_functions.sql)
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Allow profile creation during sign-up
CREATE POLICY "Enable insert for authenticated users or signup service" 
  ON public.profiles FOR INSERT 
  WITH CHECK (true);
