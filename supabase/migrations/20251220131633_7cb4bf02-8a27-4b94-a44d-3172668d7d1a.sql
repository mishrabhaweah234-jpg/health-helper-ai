-- Add is_online column to profiles table for doctor availability
ALTER TABLE public.profiles ADD COLUMN is_online boolean NOT NULL DEFAULT false;

-- Allow doctors to update their online status
CREATE POLICY "Doctors can update their online status"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id AND has_role(auth.uid(), 'doctor'::app_role));