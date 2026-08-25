-- ============================================
-- SCHOOL PLANNER V1 - COMPREHENSIVE SCHEMA
-- ============================================

-- Schools (registered by admin approval)
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  zip_code TEXT,
  school_type TEXT CHECK (school_type IN ('grundschule','realschule','gymnasium','gesamtschule','foerderschule','berufsschule','sonstige')) NOT NULL,
  admin_email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  modules JSONB DEFAULT '{"timetable":true,"substitution":true,"homework":true,"exams":true,"tests":true,"grades":true,"calendar":true,"messages":true,"subjects":true,"classbook":true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- School registration requests
CREATE TABLE IF NOT EXISTS school_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  address TEXT,
  school_type TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (all roles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('super_admin','admin','school_admin','teacher','student')) NOT NULL,
  class_name TEXT,
  class_teacher_of TEXT,
  vice_class_teacher_of TEXT,
  subjects TEXT[],
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  birth_date DATE,
  access_code TEXT,
  access_code_attempts INT DEFAULT 0,
  access_code_used BOOLEAN DEFAULT FALSE,
  setup_complete BOOLEAN DEFAULT FALSE,
  force_email BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  grade_level INT,
  class_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  vice_class_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  color TEXT DEFAULT '#F97316',
  teacher TEXT,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 4) NOT NULL,
  period_start INT NOT NULL,
  period_end INT NOT NULL,
  room TEXT,
  teacher TEXT,
  week_type TEXT DEFAULT 'A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Homework (teacher creates, students see)
CREATE TABLE IF NOT EXISTS homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  priority TEXT CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grades
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  grade DECIMAL(3,1) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.0,
  type TEXT CHECK (type IN ('oral','written','exam','participation','homework')) DEFAULT 'oral',
  title TEXT,
  date DATE DEFAULT CURRENT_DATE,
  comment TEXT,
  visible_to_student BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL,
  duration_minutes INT,
  room TEXT,
  topic TEXT,
  notes TEXT,
  grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  end_date DATE,
  end_time TIME,
  all_day BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT '#F97316',
  event_type TEXT CHECK (event_type IN ('exam','homework','school','personal','holiday')) DEFAULT 'school',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Substitutions
CREATE TABLE IF NOT EXISTS substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period INT NOT NULL,
  original_subject TEXT,
  original_teacher TEXT,
  original_room TEXT,
  substitute_teacher TEXT,
  substitute_room TEXT,
  substitute_subject TEXT,
  note TEXT,
  status TEXT CHECK (status IN ('cancelled','substituted','room_change','free')) DEFAULT 'substituted',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ TEST SYSTEM ============

-- Tests (created by teacher)
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  access_code TEXT NOT NULL,
  link_url TEXT,
  time_limit_minutes INT,
  is_unlimited BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  max_points INT DEFAULT 0,
  start_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test questions
CREATE TABLE IF NOT EXISTS test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('mc','text','number','true_false','image')) NOT NULL,
  options JSONB,
  correct_answer JSONB,
  points INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student test submissions (who started/finished)
CREATE TABLE IF NOT EXISTS test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  total_points INT DEFAULT 0,
  grade TEXT,
  feedback TEXT,
  visible_to_student BOOLEAN DEFAULT FALSE,
  UNIQUE(test_id, student_id)
);

-- Student answers per question
CREATE TABLE IF NOT EXISTS test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES test_submissions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES test_questions(id) ON DELETE CASCADE NOT NULL,
  answer JSONB,
  points_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, question_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT CHECK (type IN ('exam','homework','test','substitution','message','general','approval','rejection')) DEFAULT 'general',
  read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_school ON timetable(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_calendar_school ON calendar_events(school_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_date ON substitutions(date);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_tests_access ON tests(access_code);
CREATE INDEX IF NOT EXISTS idx_tests_teacher ON tests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_test ON test_submissions(test_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "School admins read school profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','school_admin') AND p.school_id = profiles.school_id)
);
CREATE POLICY "Admins manage school users" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','school_admin'))
);

-- Schools
CREATE POLICY "Anyone can read schools" ON schools FOR SELECT USING (true);
CREATE POLICY "Admins manage schools" ON schools FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
);

-- School requests
CREATE POLICY "Anyone can insert requests" ON school_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read requests" ON school_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
);
CREATE POLICY "Admins update requests" ON school_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
);

-- Classes
CREATE POLICY "School members read classes" ON classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = classes.school_id)
);
CREATE POLICY "Admins manage classes" ON classes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','school_admin') AND school_id = classes.school_id)
);

-- Generic school-scoped policies
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
CREATE POLICY "School scoped notifications" ON notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = notifications.school_id)
);

-- Tests
CREATE POLICY "School scoped tests" ON tests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = tests.school_id)
);
CREATE POLICY "School scoped questions" ON test_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM tests t JOIN profiles p ON p.id = auth.uid() WHERE t.id = test_questions.test_id AND t.school_id = p.school_id)
);
CREATE POLICY "School scoped submissions" ON test_submissions FOR ALL USING (
  EXISTS (SELECT 1 FROM tests t JOIN profiles p ON p.id = auth.uid() WHERE t.id = test_submissions.test_id AND t.school_id = p.school_id)
);
CREATE POLICY "School scoped answers" ON test_answers FOR ALL USING (
  EXISTS (SELECT 1 FROM test_submissions ts JOIN tests t ON t.id = ts.test_id JOIN profiles p ON p.id = auth.uid() WHERE ts.id = test_answers.submission_id AND t.school_id = p.school_id)
);
