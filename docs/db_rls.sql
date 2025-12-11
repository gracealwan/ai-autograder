------
-- Users table
------

alter table users enable row level security;

-- Select your own user record
create policy "Users can read themselves" 
on users
for select
using ( id = current_user_id() );


------
-- Assignments table
------

alter table assignments enable row level security;

-- Teachers create assignments
create policy "Teachers can insert assignments" 
on assignments
for insert
with check ( current_user_role() = 'teacher' and teacher_id = current_user_id() );

-- Teachers read assignments they own
create policy "Teachers read own assignments"
on assignments
for select
using ( teacher_id = current_user_id() );

-- Students read assignments they are associated with via submissions
create policy "Students read joined assignments"
on assignments
for select
using (
  current_user_role() = 'student'
  and exists (
    select 1 from submissions s
    where s.assignment_id = assignments.id
      and s.student_id = current_user_id()
  )
);

-- Teachers update only their own assignments
create policy "Teachers update own assignments"
on assignments
for update
using ( teacher_id = current_user_id() )
with check ( teacher_id = current_user_id() );

------
-- Rubrics table
------
alter table rubrics enable row level security;

-- Teachers read their assignment rubrics
create policy "Teachers read rubrics"
on rubrics
for select
using (
  exists (
    select 1 from assignments a
    where a.id = assignment_id
      and a.teacher_id = current_user_id()
  )
);

-- Students read rubrics for their submissions
create policy "Students read rubrics"
on rubrics
for select
using (
  current_user_role() = 'student' and
  exists (
    select 1 from submissions s
    where s.assignment_id = rubrics.assignment_id
      and s.student_id = current_user_id()
  )
);

-- Teachers create new rubric versions
create policy "Teachers insert rubrics"
on rubrics
for insert
with check (
  exists (
    select 1 from assignments a
    where a.id = assignment_id
      and a.teacher_id = current_user_id()
  )
);

------
-- Rubric_changes table
------
alter table rubric_changes enable row level security;

-- Teachers log changes
create policy "Teachers insert rubric changes"
on rubric_changes
for insert
with check (
  exists (
    select 1 from assignments a
    where a.id = assignment_id
      and a.teacher_id = current_user_id()
  )
);

-- Teachers read changes
create policy "Teachers read rubric changes"
on rubric_changes
for select
using (
  exists (
    select 1 from assignments a
    where a.id = assignment_id
      and a.teacher_id = current_user_id()
  )
);

-- Students read changes for their assignments
create policy "Students read rubric changes"
on rubric_changes
for select
using (
  current_user_role() = 'student'
  and exists (
    select 1 from submissions s
    where s.assignment_id = rubric_changes.assignment_id
      and s.student_id = current_user_id()
  )
);

------
-- Submissions table
------
alter table submissions enable row level security;

-- Students create their submission
create policy "Students insert their submission"
on submissions
for insert
with check ( student_id = current_user_id() );

-- Students update only their own submission
create policy "Students update own submission"
on submissions
for update
using ( student_id = current_user_id() )
with check ( student_id = current_user_id() );

-- Students read their own submission
create policy "Students read their submission"
on submissions
for select
using ( student_id = current_user_id() );

-- Teachers read submissions for their assignments
create policy "Teachers read submissions for their assignments"
on submissions
for select
using (
  exists (
    select 1 from assignments a
    where a.id = submissions.assignment_id
      and a.teacher_id = current_user_id()
  )
);

------
-- Question_grades table
------
alter table question_grades enable row level security;

-- Students read their own grades
create policy "Students read own grades"
on question_grades
for select
using (
  exists (
    select 1 from submissions s
    where s.id = submission_id
      and s.student_id = current_user_id()
  )
);

-- Teachers read grades for their assignments
create policy "Teachers read grades for their assignments"
on question_grades
for select
using (
  exists (
    select 1 from submissions s
    join assignments a on a.id = s.assignment_id
    where s.id = submission_id
      and a.teacher_id = current_user_id()
  )
);

------
-- Allow teachers to see student names
------
create policy "Teachers read student users for their assignments"
on users
for select
using (
  current_user_role() = 'teacher'
  and exists (
    select 1
    from submissions s
    join assignments a on a.id = s.assignment_id
    where s.student_id = users.id
      and a.teacher_id = current_user_id()
  )
);
