-- ============================================
-- MIGRATION 006: RLS Complete Fix
-- Root cause: Migration 003 renamed super_admin->ceo in DB,
-- but ALL old policies still check for super_admin/admin only.
-- Result: CEO cannot read any data, school_requests has no
-- working anonymous insert policy, notifications blocked.
-- This rebuilds every policy with the correct role set.
-- ============================================

-- Helper roles:
-- SYSTEM = super_admin, ceo, head_admin, admin, supporter
-- SCHOOL_MGMT = school_admin (Schulleiter)

-- ========== PROFILES ==========
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Insert own profile" ON profiles;
DROP POLICY IF EXISTS "School admins read school profiles" ON profiles;
DROP POLICY IF EXISTS "Admins manage school users" ON profiles;

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "System admins full access" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);

CREATE POLICY "School admin read same school" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('school_admin','ceo','head_admin','admin','supporter')
    AND profiles.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
);

-- ========== SCHOOLS ==========
DROP POLICY IF EXISTS "Anyone can read schools" ON schools;
DROP POLICY IF EXISTS "Admins manage schools" ON schools;

CREATE POLICY "Anyone can read schools" ON schools FOR SELECT USING (true);
CREATE POLICY "System admins manage schools" ON schools FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);

-- ========== SCHOOL REQUESTS ==========
DROP POLICY IF EXISTS "Anyone can insert requests" ON school_requests;
DROP POLICY IF EXISTS "Admins read requests" ON school_requests;
DROP POLICY IF EXISTS "Admins update requests" ON school_requests;

CREATE POLICY "Anyone can insert requests" ON school_requests FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');
CREATE POLICY "Anyone can read requests" ON school_requests FOR SELECT USING (true);
CREATE POLICY "System admins update requests" ON school_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);
CREATE POLICY "System admins delete requests" ON school_requests FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);

-- ========== CLASSES ==========
DROP POLICY IF EXISTS "School members read classes" ON classes;
DROP POLICY IF EXISTS "Admins manage classes" ON classes;

CREATE POLICY "School members read classes" ON classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = classes.school_id)
);
CREATE POLICY "School staff manage classes" ON classes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND school_id = classes.school_id
    AND role IN ('super_admin','ceo','head_admin','admin','supporter','school_admin','teacher'))
);

-- ========== GENERIC SCHOOL-SCOPED TABLES ==========
DROP POLICY IF EXISTS "School scoped subjects" ON subjects;
DROP POLICY IF EXISTS "School scoped timetable" ON timetable;
DROP POLICY IF EXISTS "School scoped homework" ON homework;
DROP POLICY IF EXISTS "School scoped grades" ON grades;
DROP POLICY IF EXISTS "School scoped exams" ON exams;
DROP POLICY IF EXISTS "School scoped events" ON calendar_events;
DROP POLICY IF EXISTS "School scoped substitutions" ON substitutions;
DROP POLICY IF EXISTS "School scoped messages" ON messages;
DROP POLICY IF EXISTS "School scoped tests" ON tests;

CREATE POLICY "School scoped subjects" ON subjects FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = subjects.school_id)
);
CREATE POLICY "School scoped timetable" ON timetable FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = timetable.school_id)
);
CREATE POLICY "School scoped homework" ON homework FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = homework.school_id)
);
CREATE POLICY "School scoped grades" ON grades FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = grades.school_id)
);
CREATE POLICY "School scoped exams" ON exams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = exams.school_id)
);
CREATE POLICY "School scoped events" ON calendar_events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = calendar_events.school_id)
);
CREATE POLICY "School scoped substitutions" ON substitutions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = substitutions.school_id)
);
CREATE POLICY "School scoped messages" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = messages.school_id)
);
CREATE POLICY "School scoped tests" ON tests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = tests.school_id)
);

-- ========== ATTENDANCE / ABSENCE ==========
DROP POLICY IF EXISTS "School attendance access" ON attendance;
DROP POLICY IF EXISTS "Super admin attendance access" ON attendance;
DROP POLICY IF EXISTS "School absence access" ON absence_requests;
DROP POLICY IF EXISTS "Super admin absence access" ON absence_requests;

CREATE POLICY "School attendance access" ON attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = attendance.school_id)
);
CREATE POLICY "School absence access" ON absence_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = absence_requests.school_id)
);

-- ========== TEST QUESTIONS / SUBMISSIONS / ANSWERS ==========
DROP POLICY IF EXISTS "School scoped questions" ON test_questions;
DROP POLICY IF EXISTS "School scoped submissions" ON test_submissions;
DROP POLICY IF EXISTS "School scoped answers" ON test_answers;

CREATE POLICY "School scoped questions" ON test_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.school_id = (SELECT t.school_id FROM tests t WHERE t.id = test_questions.test_id))
);
CREATE POLICY "School scoped submissions" ON test_submissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p JOIN tests t ON t.id = test_submissions.test_id
    WHERE p.id = auth.uid() AND p.school_id = t.school_id)
);
CREATE POLICY "School scoped answers" ON test_answers FOR ALL USING (
  EXISTS (SELECT 1 FROM test_submissions ts JOIN tests t ON t.id = ts.test_id
    JOIN profiles p ON p.id = auth.uid()
    WHERE ts.id = test_answers.submission_id AND p.school_id = t.school_id)
);

-- ========== NOTIFICATIONS (system-wide, nullable school_id) ==========
DROP POLICY IF EXISTS "School scoped notifications" ON notifications;
CREATE POLICY "Notifications access" ON notifications FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);

-- ========== SUPPORT TICKETS ==========
DROP POLICY IF EXISTS "Admin/supporter full access" ON support_tickets;
DROP POLICY IF EXISTS "School admin can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "School admin read own tickets" ON support_tickets;

CREATE POLICY "System staff full access" ON support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);
CREATE POLICY "School admin can create tickets" ON support_tickets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('school_admin','teacher'))
);
CREATE POLICY "School admin read own tickets" ON support_tickets FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Admin/supporter full access messages" ON ticket_messages;
DROP POLICY IF EXISTS "School admin read own ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "School admin insert messages" ON ticket_messages;

CREATE POLICY "System staff full access messages" ON ticket_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);
CREATE POLICY "Ticket creator read messages" ON ticket_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_messages.ticket_id AND st.created_by = auth.uid())
);
CREATE POLICY "Ticket creator insert messages" ON ticket_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_messages.ticket_id AND st.created_by = auth.uid())
);

-- ========== ANNOUNCEMENTS (incl. DELETE) ==========
DROP POLICY IF EXISTS "Admin can manage announcements" ON announcements;
DROP POLICY IF EXISTS "Users read active announcements" ON announcements;

CREATE POLICY "System staff manage announcements" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);
CREATE POLICY "Everyone read active announcements" ON announcements FOR SELECT USING (is_active = true);

-- ========== ADMIN INVITATIONS ==========
DROP POLICY IF EXISTS "Admin manage invitations" ON admin_invitations;
CREATE POLICY "System staff manage invitations" ON admin_invitations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin'))
);

-- ========== SECURITY/TECH TABLES ==========
-- login_security: anyone can read/insert/update (email lookup pre-auth)
DROP POLICY IF EXISTS "Anyone can read login_security" ON login_security;
DROP POLICY IF EXISTS "Anyone can insert login_security" ON login_security;
DROP POLICY IF EXISTS "Anyone can update login_security" ON login_security;
CREATE POLICY "Anyone can read login_security" ON login_security FOR SELECT USING (true);
CREATE POLICY "Anyone can insert login_security" ON login_security FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update login_security" ON login_security FOR UPDATE USING (true);

-- security_events: insert anyone, read by system staff
DROP POLICY IF EXISTS "Anyone can insert security_events" ON security_events;
DROP POLICY IF EXISTS "System admins read security_events" ON security_events;
CREATE POLICY "Anyone can insert security_events" ON security_events FOR INSERT WITH CHECK (true);
CREATE POLICY "System staff read security_events" ON security_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);

-- email_log: insert anyone, read by system staff
DROP POLICY IF EXISTS "Anyone can insert email_log" ON email_log;
DROP POLICY IF EXISTS "System admins read email_log" ON email_log;
CREATE POLICY "Anyone can insert email_log" ON email_log FOR INSERT WITH CHECK (true);
CREATE POLICY "System staff read email_log" ON email_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','ceo','head_admin','admin','supporter'))
);