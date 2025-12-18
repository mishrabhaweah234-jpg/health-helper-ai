-- Allow doctors to delete conversations they are assigned to
CREATE POLICY "Doctors can delete conversations"
ON public.conversations
FOR DELETE
USING (has_role(auth.uid(), 'doctor'::app_role) AND doctor_id = auth.uid());

-- Allow doctors to delete messages in their conversations
CREATE POLICY "Doctors can delete messages in their conversations"
ON public.messages
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.id = messages.conversation_id
  AND c.doctor_id = auth.uid()
  AND has_role(auth.uid(), 'doctor'::app_role)
));