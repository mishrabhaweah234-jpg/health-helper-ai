-- Add specialization column to profiles table for doctors
ALTER TABLE public.profiles ADD COLUMN specialization text;

-- Allow doctors to update their own profile (already exists but ensuring it covers specialization)
-- No additional policies needed as the existing UPDATE policy covers this