-- Create required extension
create extension if not exists pgcrypto;

-- USERS
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  role text not null,
  password_hash text,
  phone text,
  avatar_url text,
  faculty text,
  department text,
  student_id text,
  program text,
  year int,
  gpa numeric,
  department_code text,
  batch text,
  title text,
  assigned_students int default 0,
  supervisor_id uuid references public.users(id),
  allocation_status text,
  internship_status text,
  internship_company text,
  internship_role text,
  cv_url text,
  cv_file_name text,
  permissions jsonb default '{}'::jsonb,
  gender text,
  academic_year text,
  internship_start_date date,
  internship_end_date date,
  approval_access boolean default true,
  created_at timestamptz default now()
);
create unique index if not exists users_email_idx on public.users(email);
create unique index if not exists users_student_id_idx on public.users(student_id) where student_id is not null;

-- Keep existing databases in sync as well. `create table if not exists` does
-- not add columns when the users table already exists.
alter table public.users
  add column if not exists gender text,
  add column if not exists academic_year text,
  add column if not exists internship_start_date date,
  add column if not exists internship_end_date date,
  add column if not exists approval_access boolean default true;

-- ANNOUNCEMENTS
create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  message text not null,
  author_id uuid references public.users(id),
  author_name text,
  author_role text,
  priority text,
  target text,
  supervisor_id uuid,
  student_id uuid,
  student_ids uuid[] default null,
  is_personal boolean default false,
  link_url text,
  attachment_name text,
  attachment_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  category text,
  created_at timestamptz default now(),
  constraint announcements_target_check check (
    target in ('all_students', 'supervisor_students', 'single_student', 'specific_students')
  )
);

-- Keep existing databases in sync as well. `create table if not exists` does
-- not add columns when the announcements table already exists.
alter table public.announcements
  add column if not exists student_id uuid,
  add column if not exists student_ids uuid[] default null,
  add column if not exists is_personal boolean default false;

-- COMPANIES
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  industry text,
  location text,
  email text,
  phone text,
  website text,
  status text,
  logo text,
  description text,
  company_letter text,
  created_at timestamptz default now()
);

-- INTERNSHIPS
create table if not exists public.internships (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  company_id uuid references public.companies(id),
  company_name text,
  location text,
  type text,
  duration text,
  deadline timestamptz,
  description text,
  requirements text[],
  slots int default 0,
  applied int default 0,
  status text,
  stipend text,
  department_category text,
  department_categories text[] default null,
  created_at timestamptz default now()
);

alter table public.internships
  add column if not exists department_categories text[] default null;

-- APPLICATIONS
create table if not exists public.applications (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id),
  student_name text,
  internship_id uuid references public.internships(id),
  internship_title text,
  company_name text,
  status text,
  applied_at timestamptz default now(),
  cover_letter text,
  cv_url text,
  document_url text,
  document_file_name text,
  document_path text
);

-- LOGBOOK REPORTS
create table if not exists public.logbook_reports (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id),
  student_name text,
  supervisor_id uuid references public.users(id),
  month_number int,
  period text,
  month_key text,
  report_type text default 'fortnightly',
  submitted_at timestamptz default now(),
  status text,
  excerpt text,
  pdf_url text,
  pdf_file_name text,
  feedback text,
  marks int,
  reviewed_at timestamptz,
  is_current boolean default false
);

-- Keep existing databases compatible with report PDF uploads.
alter table public.logbook_reports
  add column if not exists student_id uuid,
  add column if not exists student_name text,
  add column if not exists supervisor_id uuid,
  add column if not exists month_number int,
  add column if not exists period text,
  add column if not exists month_key text,
  add column if not exists report_type text default 'fortnightly',
  add column if not exists submitted_at timestamptz default now(),
  add column if not exists status text,
  add column if not exists excerpt text,
  add column if not exists pdf_url text,
  add column if not exists pdf_file_name text,
  add column if not exists feedback text,
  add column if not exists marks int,
  add column if not exists reviewed_at timestamptz,
  add column if not exists is_current boolean default false;

-- PROGRESS REPORTS
create table if not exists public.progress_reports (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id),
  student_name text,
  week int,
  submitted_at timestamptz default now(),
  status text,
  summary text,
  achievements text[],
  challenges text[]
);

-- REVIEWS
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id),
  student_name text,
  supervisor_id uuid references public.users(id),
  title text,
  type text,
  submitted_at timestamptz default now(),
  status text,
  content text,
  feedback text,
  score int,
  attachment_url text,
  attachment_name text
);

alter table public.reviews
  add column if not exists attachment_url text,
  add column if not exists attachment_name text;

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  audience text,
  user_id uuid references public.users(id),
  title text,
  message text,
  read boolean default false,
  created_at timestamptz default now(),
  type text,
  category text
);

-- SYSTEM SETTINGS
create table if not exists public.system_settings (
  id uuid default gen_random_uuid() primary key,
  label text,
  description text,
  value text,
  type text,
  options text[]
);

create table if not exists public.report_deadlines (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  student_name text,
  month_number int not null,
  period text not null,
  due_date timestamptz not null,
  report_type text default 'Monthly Logbook',
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_report_deadlines_student_due
  on public.report_deadlines(student_id, due_date);

create unique index if not exists idx_report_deadlines_student_month
  on public.report_deadlines(student_id, month_number);

-- TRAINING MONITORING
create table if not exists public.placement_confirmations (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  organization text,
  address text,
  nature text,
  department text,
  role text,
  start_date date,
  end_date date,
  external_supervisor_name text,
  external_supervisor_designation text,
  external_supervisor_email text,
  external_supervisor_phone text,
  file_url text not null,
  file_name text,
  status text default 'submitted',
  reviewer_feedback text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id)
);

alter table public.placement_confirmations
  add column if not exists reviewer_feedback text;

create table if not exists public.training_documents (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  document_type text not null,
  title text not null,
  file_url text not null,
  file_name text,
  issued_by uuid references public.users(id),
  issued_at timestamptz default now()
);

create table if not exists public.commencement_confirmations (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  placement_confirmation_id uuid references public.placement_confirmations(id),
  file_url text not null,
  file_name text,
  status text default 'submitted',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  reviewer_feedback text
);

create table if not exists public.external_supervisor_appointments (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  placement_confirmation_id uuid references public.placement_confirmations(id),
  external_supervisor_name text,
  external_supervisor_email text not null,
  internal_supervisor_id uuid references public.users(id),
  coordinator_id uuid references public.users(id),
  status text default 'sent',
  sent_at timestamptz default now()
);

create table if not exists public.seminar_events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  event_date timestamptz not null,
  location text,
  audience text default 'students',
  description text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table if not exists public.weekly_certifications (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  supervisor_id uuid references public.users(id),
  external_supervisor_id uuid references public.users(id),
  week_start_date date not null,
  week_end_date date not null,
  daily_log_ids uuid[] default '{}',
  file_url text,
  status text default 'submitted',
  external_supervisor_feedback text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  unique(student_id, week_start_date)
);

alter table public.weekly_certifications
  add column if not exists external_supervisor_id uuid references public.users(id);

create table if not exists public.site_visits (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  supervisor_id uuid references public.users(id),
  proposed_date date,
  actual_date date,
  mode text,
  observations text,
  actions_recommended text,
  provider_feedback text,
  status text default 'scheduled',
  created_at timestamptz default now()
);

create table if not exists public.meeting_attendance (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  supervisor_id uuid not null references public.users(id),
  meeting_date date not null,
  meeting_type text default 'monthly_progress',
  attended boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.completion_recommendations (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade unique,
  supervisor_id uuid references public.users(id),
  diary_maintained boolean,
  reports_submitted boolean,
  training_duration_completed boolean,
  decision text not null,
  comments text,
  updated_at timestamptz default now()
);

create table if not exists public.attendance_records (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  external_supervisor_id uuid references public.users(id),
  attendance_date date not null,
  status text not null,
  remarks text,
  unique(student_id, attendance_date)
);

create table if not exists public.completion_certifications (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade unique,
  external_supervisor_id uuid references public.users(id),
  period_from date,
  period_to date,
  departments text,
  work_comments text,
  conduct_comments text,
  attendance_comments text,
  performance_score int,
  performance_comments text,
  performance_status text default 'submitted',
  completion_file_url text,
  completion_file_name text,
  certified_at timestamptz default now()
);

alter table public.completion_certifications
  add column if not exists performance_score int,
  add column if not exists performance_comments text,
  add column if not exists performance_status text default 'pending_review',
  add column if not exists completion_file_url text,
  add column if not exists completion_file_name text;

create table if not exists public.external_monthly_progress (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade,
  external_supervisor_id uuid references public.users(id),
  month_key text not null,
  attendance_score int,
  punctuality_score int,
  teamwork_score int,
  comments text,
  status text default 'submitted',
  submitted_at timestamptz default now(),
  unique(student_id, month_key)
);

-- STUDENT CONDUCT AND SUPPORT
create table if not exists public.leave_requests (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  leave_type text not null,
  date_from date not null,
  date_to date not null,
  reason text not null,
  attachment_url text,
  attachment_name text,
  status text default 'pending',
  reviewer_id uuid references public.users(id),
  reviewer_response text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.absence_reports (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  absence_dates text not null,
  reason text not null,
  attachment_url text,
  attachment_name text,
  status text default 'pending',
  reviewer_id uuid references public.users(id),
  reviewer_response text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.placement_change_requests (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  proposed_organization text,
  reason text not null,
  supporting_notes text,
  attachment_url text,
  attachment_name text,
  status text default 'pending',
  reviewer_id uuid references public.users(id),
  reviewer_response text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.student_issues (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  issue_type text not null,
  severity text not null,
  description text not null,
  attachment_url text,
  attachment_name text,
  status text default 'open',
  reviewer_id uuid references public.users(id),
  reviewer_response text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.communication_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid references public.users(id),
  subject text,
  message text not null,
  related_type text,
  related_id uuid,
  recipient_role text,
  recipient_email text,
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table public.communication_messages
  add column if not exists recipient_role text,
  add column if not exists recipient_email text;

-- FINAL EVALUATIONS
create table if not exists public.evaluation_records (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  evaluator_id uuid references public.users(id),
  components jsonb not null default '[]'::jsonb,
  overall_mark numeric,
  decision text not null default 'resubmit',
  notes text,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id)
);

-- FORM C: Details of Industrial Training Completed
create table if not exists public.form_c_submissions (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  form_data jsonb not null default '{}'::jsonb,
  file_url text,
  file_name text,
  status text default 'draft',
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id)
);

-- MONTHLY REPORTS generated from student personal information and daily logs
create table if not exists public.monthly_reports (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null references public.users(id) on delete cascade,
  month_key text not null,
  report_data jsonb not null default '{}'::jsonb,
  file_url text,
  file_name text,
  status text default 'draft',
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id, month_key)
);

-- Grants for service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
