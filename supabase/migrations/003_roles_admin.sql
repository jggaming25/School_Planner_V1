-- ============================================
-- MIGRATION 003: Roles, Support, Announcements
-- Run AFTER 002_features.sql
-- ============================================

-- 1. Bestehende Rollen migrieren (super_admin -> ceo)
UPDATE profiles SET role = 'ceo' WHERE role = 'super_admin';

-- 2. Erweiterte Rollen
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('ceo','head_admin','admin','supporter','school_admin','teacher','student'));

-- 2. Support-Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('account','password','deactivate','delete','timetable','grades','general')) DEFAULT 'general',
  status TEXT CHECK (status IN ('open','claimed','in_progress','resolved','closed')) DEFAULT 'open',
  claimed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/supporter full access" ON support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo','head_admin','admin','supporter'))
);
CREATE POLICY "School admin can create tickets" ON support_tickets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'school_admin')
);
CREATE POLICY "School admin read own tickets" ON support_tickets FOR SELECT USING (
  created_by = auth.uid()
);

-- 3. Ticket-Nachrichten
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/supporter full access messages" ON ticket_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo','head_admin','admin','supporter'))
);
CREATE POLICY "School admin read own ticket messages" ON ticket_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_messages.ticket_id AND st.created_by = auth.uid())
);
CREATE POLICY "School admin insert messages" ON ticket_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_messages.ticket_id AND st.created_by = auth.uid())
);

-- 4. Wartungsmeldungen
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  target_roles TEXT[] DEFAULT ARRAY['school_admin','teacher','student'],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage announcements" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo','head_admin','admin','supporter'))
);
CREATE POLICY "Users read active announcements" ON announcements FOR SELECT USING (is_active = true);

-- 5. Admin-Einladungen
CREATE TABLE IF NOT EXISTS admin_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage invitations" ON admin_invitations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo','head_admin','admin'))
);
