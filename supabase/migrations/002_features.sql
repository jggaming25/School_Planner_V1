-- ============================================
-- MIGRATION 002: New Features
-- Run this AFTER full-reset.sql
-- ============================================

-- 1. Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  class_name TEXT NOT NULL,
  date DATE NOT NULL,
  period INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  late_minutes INT DEFAULT 0,
  marked_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_name, date);
CREATE INDEX IF NOT EXISTS idx_attendance_school ON attendance(school_id, date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School attendance access" ON attendance
  FOR ALL USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Super admin attendance access" ON attendance
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- 2. Absence requests table
CREATE TABLE IF NOT EXISTS absence_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT NOT NULL,
  reason_type TEXT DEFAULT 'other' CHECK (reason_type IN ('illness','appointment','family','vacation','other')),
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absence_student ON absence_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_absence_status ON absence_requests(status);
CREATE INDEX IF NOT EXISTS idx_absence_school ON absence_requests(school_id);

ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School absence access" ON absence_requests
  FOR ALL USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Super admin absence access" ON absence_requests
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- 3. Add school_settings column to schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_settings JSONB DEFAULT '{
  "max_periods": 8,
  "period_times": [
    {"start": "08:00", "end": "08:45"},
    {"start": "08:50", "end": "09:35"},
    {"start": "09:50", "end": "10:35"},
    {"start": "10:40", "end": "11:25"},
    {"start": "11:30", "end": "12:15"},
    {"start": "12:20", "end": "13:05"},
    {"start": "13:15", "end": "14:00"},
    {"start": "14:05", "end": "14:50"}
  ],
  "school_start": "08:00",
  "school_end": "14:50"
}'::jsonb;

-- 4. Add is_active to profiles for enable/disable
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 5. Add weight_type to grades for Schulmanager-style weighting
ALTER TABLE grades ADD COLUMN IF NOT EXISTS weight_type TEXT DEFAULT 'normal' CHECK (weight_type IN ('normal','half','full','bonus'));
ALTER TABLE grades ADD COLUMN IF NOT EXISTS max_points INT DEFAULT NULL;

-- 6. Storage bucket for absence files
INSERT INTO storage.buckets (id, name, public) VALUES ('absence-files', 'absence-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'absence-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated read" ON storage.objects
  FOR SELECT USING (bucket_id = 'absence-files' AND auth.role() = 'authenticated');
