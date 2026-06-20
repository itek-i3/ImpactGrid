-- Run in Supabase SQL Editor to add missing profile columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT,
  ADD COLUMN IF NOT EXISTS phone       TEXT;
