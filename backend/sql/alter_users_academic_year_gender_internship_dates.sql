-- Migration: academic year, gender, internship duration, external supervisor
-- approval access, daily-log attachments and multi-recipient communication log.
-- Run this against the existing database to add the new columns and tables.

-- USERS: new profile columns
alter table public.users
  add column if not exists gender text,
  add column if not exists academic_year text,
  add column if not exists internship_start_date date,
  add column if not exists internship_end_date date,
  add column if not exists approval_access boolean default true;

-- REVIEWS (daily log entries): additional attachment in any file format
alter table public.reviews
  add column if not exists attachment_url text,
  add column if not exists attachment_name text;

-- COMMUNICATION MESSAGES: address messages to a role (coordinator, supervisor,
-- external supervisor) even when the recipient has no account yet.
alter table public.communication_messages
  add column if not exists recipient_role text,
  add column if not exists recipient_email text;

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

-- MONTHLY REPORTS generated from the student's personal information and
-- daily logbook entries.
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
