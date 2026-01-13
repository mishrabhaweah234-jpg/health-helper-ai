-- 1. Fix: Users can grant themselves doctor privileges
-- Remove the dangerous INSERT policy on user_roles
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;

-- 2. Fix: Patient medical symptoms leaked to all doctors
-- Doctors should only see unclaimed conversations or their own
DROP POLICY IF EXISTS "Doctors can view all conversations" ON public.conversations;

CREATE POLICY "Doctors can view available or assigned conversations"
ON public.conversations FOR SELECT
USING (
  auth.uid() = patient_id
  OR (
    has_role(auth.uid(), 'doctor'::app_role) 
    AND (doctor_id IS NULL OR doctor_id = auth.uid())
  )
);

-- 3. Fix: Doctors can update any conversation - restrict to claim or update own
DROP POLICY IF EXISTS "Doctors can update conversations" ON public.conversations;

CREATE POLICY "Doctors can claim or update own conversations"
ON public.conversations FOR UPDATE
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND (doctor_id IS NULL OR doctor_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND (doctor_id IS NULL OR doctor_id = auth.uid())
);

-- 4. Fix: Patients cannot find available doctors
-- Add policy for patients to view online doctor profiles
CREATE POLICY "Patients can view online doctor profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'patient'::app_role)
  AND has_role(user_id, 'doctor'::app_role)
  AND is_online = true
);

-- 5. Fix: Video calls fail due to hidden participant info
-- Add policy for call participants to see each other's profiles
CREATE POLICY "Call participants can view each other profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.call_sessions cs
    WHERE cs.status IN ('pending', 'active')
    AND (
      (cs.caller_id = auth.uid() AND cs.callee_id = profiles.user_id)
      OR (cs.callee_id = auth.uid() AND cs.caller_id = profiles.user_id)
    )
  )
);