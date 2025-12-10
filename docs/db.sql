-- =======================================================
-- USERS
-- =======================================================

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text,
  role text not null check (role in ('teacher','student')),
  created_at timestamptz default now()
);

-- Sync auth.users → public.users on signup
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do update
    set email = excluded.email,
        role  = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

-- Supabase RLS Helpers
create or replace function public.current_user_id()
returns uuid
language sql stable
as $$
  select auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql stable
as $$
  select role from public.users where id = auth.uid();
$$;


-- =======================================================
-- ASSIGNMENTS
-- =======================================================

create table assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =======================================================
-- RUBRICS (versioned)
-- =======================================================

create table rubrics (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  rubric_json jsonb not null,              -- full goals + points json
  version integer not null,                -- incremented by the app
  generated_at timestamptz default now()
);

-- Convenience index for fetching “latest version”
create index rubrics_assignment_version_idx
  on rubrics (assignment_id, version desc);

-- =======================================================
-- RUBRIC CHANGE LOG (for regrade triggers)
-- =======================================================

create table rubric_changes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  old_version integer,
  new_version integer,
  triggered_regrade boolean default true,
  changed_at timestamptz default now()
);

-- =======================================================
-- SUBMISSIONS
-- =======================================================

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  student_id uuid references users(id) on delete cascade,

  -- whiteboard strokes per question (JSON)
  -- structure: { "Q1": {...}, "Q2": {...}, ... }
  work_json jsonb default '{}'::jsonb,

  current_question integer default 0,
  completed boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =======================================================
-- QUESTION GRADES
-- =======================================================

create table question_grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  question_index integer not null,

  rubric_version integer not null,

  -- structure:
  -- {
  --   "Correct Solution": { "achieved": true, "points": 4, "max": 4 },
  --   "Correct Method": { "achieved": false, "points": 0, "max": 3 },
  --   ...
  -- }
  per_goal jsonb not null,

  total_points numeric not null,
  max_points numeric not null,

  feedback text,
  graded_at timestamptz default now()
);

-- Quickly lookup grades for an assignment
create index question_grades_submission_idx
  on question_grades (submission_id, question_index);
