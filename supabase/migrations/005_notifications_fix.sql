-- ============================================
-- MIGRATION 005: Fix notifications for system admins
-- ============================================

-- 1. Make school_id nullable for system-wide notifications
ALTER TABLE notifications ALTER COLUMN school_id DROP NOT NULL;

-- 2. Add 'announcement' to the type CHECK constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('exam','homework','test','substitution','message','general','approval','rejection','announcement'));

-- 3. Relax RLS so system admins can get notifications without school_id
DROP POLICY IF EXISTS "School scoped notifications" ON notifications;
CREATE POLICY "School scoped notifications" ON notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (
    school_id = notifications.school_id OR 
    notifications.school_id IS NULL OR
    (profiles.role IN ('super_admin','ceo','head_admin','admin','supporter') AND profiles.id = notifications.user_id)
  ))
);
