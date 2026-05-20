INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-attachments', 'clinical-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Clinical attachments are readable by authenticated users" ON storage.objects;
CREATE POLICY "Clinical attachments are readable by authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'clinical-attachments');

DROP POLICY IF EXISTS "Clinical attachments can be uploaded by authenticated users" ON storage.objects;
CREATE POLICY "Clinical attachments can be uploaded by authenticated users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'clinical-attachments');

DROP POLICY IF EXISTS "Clinical attachments can be updated by authenticated users" ON storage.objects;
CREATE POLICY "Clinical attachments can be updated by authenticated users"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'clinical-attachments')
WITH CHECK (bucket_id = 'clinical-attachments');

DROP POLICY IF EXISTS "Clinical attachments can be deleted by authenticated users" ON storage.objects;
CREATE POLICY "Clinical attachments can be deleted by authenticated users"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'clinical-attachments');
