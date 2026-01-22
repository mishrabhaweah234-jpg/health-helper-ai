-- Fix: Add server-side validation for doctor role assignment
-- This prevents privilege escalation by validating doctor email on the server

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role app_role;
BEGIN
  requested_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'patient');
  
  -- Server-side validation: only allow doctor role for authorized email
  -- If someone tries to sign up as doctor with unauthorized email, force to patient role
  IF requested_role = 'doctor' AND LOWER(NEW.email) != 'doctor123@gmail.com' THEN
    requested_role := 'patient';
  END IF;
  
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role);
  
  RETURN NEW;
END;
$$;