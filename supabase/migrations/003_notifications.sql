-- =====================================================
-- Notifications: рассылка подрядчикам (демо-фейк)
-- =====================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,                              -- 'overdue_reminder' | 'custom'
  recipient_contractor_id UUID REFERENCES contractors(id),
  apartment_ids UUID[] DEFAULT '{}',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_contractor_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and sales can read notifications" ON notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales'))
  );

CREATE POLICY "Admin and sales can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales'))
  );
