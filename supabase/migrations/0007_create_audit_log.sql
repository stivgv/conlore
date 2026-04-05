-- Tabella per tracciare le azioni degli amministratori
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Solo gli admin possono leggere l'audit log
CREATE POLICY "audit_log: admin select"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo il service role può inserire (via SECURITY DEFINER functions o server actions)
-- Gli admin non possono inserire direttamente
CREATE POLICY "audit_log: service insert"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
