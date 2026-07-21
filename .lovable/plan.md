# Teacher Evaluation Feedback App

A single-URL, anonymous, one-day feedback tool for classes VI–XI, plus a simple admin view for the results.

## User flow (student side, `/`)

A single wizard page with clear step progression:

1. **Class** — 6 large buttons: VI, VII, VIII, IX, X, XI.
2. **Section** — buttons for sections available for that class (VI–X: A–E; XI: A–D).
3. **Optional subject (IX/X only, and only when the section has 2 options)** — e.g. IX-C shows "Computer Application" vs "EVA". Sections with only one optional subject skip this step and silently include that subject as an extra card.
4. **Rate subjects** — one card per subject:
  - VI–VIII: fixed subject list from config.
  - IX/X: base subjects + the chosen (or only) optional subject.
  - XI: subjects derived from `sectionStream[section]` → `subjectsByStream`. Science sections always show both Biology and Computer Science. Ok but I am not sure if you are understanding, class 11 has 4 sections, a, b,c,d so all four sections have students mixed in - Bio maths, csc-maths, commerce-maths and commerce computer.. so it's complicated can just skip 11 for now do ahead with classes vi to x.
  - Each card shows the subject name large (never the teacher name), 10 questions in the exact order given, a 1–5 radio scale per question with subtle red→green tint, a legend "1 = Strongly Disagree · 5 = Strongly Agree", and an optional comment box "Anything else to mention?".
5. **Submit** — one button submits all cards atomically. Client validates every question is answered; unanswered questions get an inline error and the page scrolls to the first missing one.
6. **Thank-you screen** — final state, no back/reset link within the session.

Back navigation between steps 1–3 is allowed; once submitted, the thank-you screen is terminal.

## Reliability requirements

- Loading state while the config module loads (config is bundled, so this is fast, but the UI still handles it).
- Friendly error screen with a Retry button for any submission or navigation failure — never a blank screen or false success.
- Server-side resolution of teacher name from the (class, section, subject, optionalSubject) input so the frontend never sees or sends teacher names.
- Submission uses a server function; on failure the UI stays on the form with an error and the answers preserved so the student can retry.

## Data model (Supabase)

Single table `public.responses`:

- `id` bigint identity primary key
- `submitted_at` timestamptz default now()
- `class` text
- `section` text
- `subject` text
- `teacher` text
- `q1`..`q10` smallint (check 1..5)
- `comment` text nullable

RLS enabled. Policies:

- `INSERT` allowed to `anon` and `authenticated` (public form).
- `SELECT` allowed to `anon` and `authenticated` for the admin viewer (low-stakes internal tool per spec).

Grants: `GRANT SELECT, INSERT ON public.responses TO anon, authenticated; GRANT ALL TO service_role;`

One submission writes N rows (one per subject) in a single insert.

## Admin view (`/admin`)

- No auth (per spec).
- Table of all rows, newest first, with filters for class/section/subject and a search box for teacher.
- "Download CSV" button that exports the currently filtered rows.
- Simple count summary at top ("X submissions across Y subject rows").
- Must be able to export the entire thing too..

## Design

- Indigo primary, neutral warm background, rounded-2xl cards, generous spacing, large tap targets (min 44px).
- 1–5 scale buttons colorized: 1 rose, 2 orange, 3 amber, 4 lime, 5 emerald — muted tints, selected state uses the saturated color.
- Semantic tokens in `src/styles.css` (no hardcoded hex in components).
- Mobile-first but comfortable on desktop (lab machines). desktop first. Mobile can be second.

## Technical notes

- **Config**: bundled as `src/lib/evaluation-config.ts` (typed) so both the client wizard and the server function share one source of truth.
- **Server function** `submitFeedback` (`src/lib/feedback.functions.ts`):
  - Input: `{ class, section, optionalSubjectKey?, answers: Array<{ subject, q1..q10, comment? }> }` validated with Zod.
  - Resolves teacher for each subject from config (rejects with clear error if any mapping is missing).
  - Inserts all rows in one call via the server publishable client (RLS allows anon insert).
  - Returns `{ ok: true }` or throws.
- **Admin fetch** via a public server function using the server publishable client (RLS SELECT to anon).
- Routes: `/` (wizard), `/admin` (table + CSV). Both public.
- Head metadata set per route (title, description, og).

## Out of scope

- No auth, no per-student identification, no duplicate-submission blocking beyond the in-session thank-you screen.
- No Class XII.
- No teacher names on any student-facing screen.