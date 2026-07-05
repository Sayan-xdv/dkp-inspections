-- =====================================================
-- Storage: бакет для PDF-отчётов экспертиз
-- Путь файла: {contractor}/{YYYY-MM}/{crm_code}.pdf
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-reports',
  'inspection-reports',
  false,
  10485760,               -- 10 МБ
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Политики на storage.objects (RLS уже включена Supabase'ом).
-- Читать могут все залогиненные роли (скачивание отчётов),
-- загружать — подрядчики и админ, удалять — админ.

DROP POLICY IF EXISTS "inspection-reports read" ON storage.objects;
CREATE POLICY "inspection-reports read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-reports');

DROP POLICY IF EXISTS "inspection-reports upload" ON storage.objects;
CREATE POLICY "inspection-reports upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-reports'
    AND public.current_user_has_role(ARRAY['contractor','admin']::app_role[])
  );

DROP POLICY IF EXISTS "inspection-reports update" ON storage.objects;
CREATE POLICY "inspection-reports update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'inspection-reports'
    AND public.current_user_has_role(ARRAY['contractor','admin']::app_role[])
  );

DROP POLICY IF EXISTS "inspection-reports delete" ON storage.objects;
CREATE POLICY "inspection-reports delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-reports'
    AND public.current_user_is_admin()
  );
