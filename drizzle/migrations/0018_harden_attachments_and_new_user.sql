DROP POLICY IF EXISTS "Clinical attachments can be uploaded by authenticated users" ON storage.objects;
CREATE POLICY "Clinical attachments can be uploaded by authenticated users" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinical-attachments' AND owner_id = (SELECT auth.uid()::text));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
begin
  insert into public.profiles (user_id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$function$;