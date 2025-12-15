## AI Autograder

An AI-assisted grading tool that lets teachers create programming/short-answer assignments, define or generate rubrics with LLMs, and automatically grade student submissions using Supabase-backed storage and OpenRouter models.

Try it out [here](https://ai-autograder-eight.vercel.app/)!

### Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **UI**: React, Tailwind CSS
- **Auth & Database**: Supabase (PostgreSQL, RLS)
- **AI**: OpenRouter-hosted LLMs (via `lib/openrouter.ts`)

### Core Functionality

- **Teacher flows**
  - Create and manage assignments and questions under `app/teacher/assignment`.
  - Generate or edit grading rubrics via AI (`app/api/rubrics/generate` and `app/api/rubrics/edit` using `prompts/rubric_generation.txt`).
  - Trigger grading for individual questions (`app/api/grade/question`) and view grading progress (`app/api/assignment/progress`).
- **Student flows**
  - See assigned work from the student dashboard (`app/student`).
  - Open an assignment, write answers, and submit solutions.
- **Backend**
  - Supabase stores users, assignments, submissions, and rubric data (schemas in `docs/db.sql` and `docs/db_rls.sql`).
  - RLS policies ensure students and teachers can only access their own data.

### Prerequisites

- **Node.js** 18+ and **npm**
- A **Supabase** project with:
  - Database initialized from `docs/db.sql`
  - RLS policies from `docs/db_rls.sql`
- An **OpenRouter** API key

### Environment Variables

Create a `.env.local` file in the project root with at least:

```bash
# Supabase (browser)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase (server-side admin)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key
```

### Running Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Then visit `http://localhost:3000` in your browser to use the app as a teacher or student (depending on how you wire up Supabase auth roles). 

