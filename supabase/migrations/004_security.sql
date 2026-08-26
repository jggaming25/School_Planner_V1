-- ============================================
-- MIGRATION 004: Security - Login Lockout + Notifications
-- ============================================

-- 1. Login-Sicherheitstabelle
CREATE TABLE IF NOT EXISTS login_security (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  unlock_token TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read login_security" ON login_security FOR SELECT USING (true);
CREATE POLICY "Anyone can insert login_security" ON login_security FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update login_security" ON login_security FOR UPDATE USING (true);

-- 2. Sicherheits-Events (Protokoll)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert security_events" ON security_events FOR INSERT WITH CHECK (true);
CREATE POLICY "System admins read security_events" ON security_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);

-- 3. Email-Log (Protokoll gesendeter Emails)
CREATE TABLE IF NOT EXISTS email_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  event_type TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admins read email_log" ON email_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);
CREATE POLICY "Anyone can insert email_log" ON email_log FOR INSERT WITH CHECK (true);
