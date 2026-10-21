# Intern & Industrial Training System

A web-based platform that connects university students with companies offering internships and
training opportunities. Students can create profiles, upload CVs, maintain their daily logbook,
and apply for vacancies, while supervisors, coordinators and external supervisors manage
recruitment, monitor training progress and evaluate performance through a centralized system.

## Tech Stack

- Next.js 15 (App Router) + React 19
- HeroUI + Tailwind CSS
- TypeScript
- Express backend (see `backend/`)
- Supabase (database, storage)

## Getting Started (frontend)

```bash
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Getting Started (backend)

```bash
cd backend
npm install
cp .env.example .env   # configure SUPABASE_URL / SUPABASE_SERVICE_KEY
npm run dev
```

Apply the SQL migrations in `backend/sql/` (in order) to keep the database schema in sync.

## Login

Use the login page and select a role (Student, Supervisor, External Supervisor, or Admin).

## Routes

### Authentication
- `/login`
- `/register`
- `/forgot-password`

### Student
- `/student/dashboard`
- `/student/profile`
- `/student/cv`
- `/student/applications`
- `/student/internships`
- `/student/daily-log`
- `/student/reports`
- `/student/conduct`
- `/student/documents`

### Supervisor
- `/supervisor/dashboard`
- `/supervisor/students`
- `/supervisor/daily-logs`
- `/supervisor/evaluations`
- `/supervisor/reviews`
- `/supervisor/reports`

### External Supervisor
- `/external-supervisor/training`
- `/external-supervisor/weekly-certification`
- `/external-supervisor/monthly-progress`
- `/external-supervisor/performance-evaluation`

### Admin
- `/admin/dashboard`
- `/admin/supervisor-student-directory`
- `/admin/supervisors`
- `/admin/companies`
- `/admin/internships`
- `/admin/reports`
- `/admin/training-monitoring`
- `/admin/training-documents`
- `/admin/conduct-review`
- `/admin/settings`

## Project Structure

```
app/           # Next.js App Router pages
components/    # Reusable UI components
backend/       # Express API + Supabase integration
lib/           # Utilities, store, navigation config
types/         # TypeScript types
public/        # Static assets (official forms, etc.)
```

## Windows Path Note

If your project folder contains `&` in the name, npm scripts use direct `node` paths to avoid
Windows shell issues.
