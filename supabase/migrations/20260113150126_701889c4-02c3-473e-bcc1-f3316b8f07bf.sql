-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Doctors can view patient profiles" ON public.profiles;

-- Create a more restrictive policy: doctors can only view profiles of patients in their conversations
CREATE POLICY "Doctors can view profiles of their patients"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id 
  OR (
    has_role(auth.uid(), 'doctor'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.doctor_id = auth.uid() 
      AND c.patient_id = profiles.user_id
    )
  )
);