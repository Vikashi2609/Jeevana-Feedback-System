CREATE TABLE public.responses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  class TEXT NOT NULL,
  section TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher TEXT NOT NULL,
  q1 SMALLINT NOT NULL CHECK (q1 BETWEEN 1 AND 5),
  q2 SMALLINT NOT NULL CHECK (q2 BETWEEN 1 AND 5),
  q3 SMALLINT NOT NULL CHECK (q3 BETWEEN 1 AND 5),
  q4 SMALLINT NOT NULL CHECK (q4 BETWEEN 1 AND 5),
  q5 SMALLINT NOT NULL CHECK (q5 BETWEEN 1 AND 5),
  q6 SMALLINT NOT NULL CHECK (q6 BETWEEN 1 AND 5),
  q7 SMALLINT NOT NULL CHECK (q7 BETWEEN 1 AND 5),
  q8 SMALLINT NOT NULL CHECK (q8 BETWEEN 1 AND 5),
  q9 SMALLINT NOT NULL CHECK (q9 BETWEEN 1 AND 5),
  q10 SMALLINT NOT NULL CHECK (q10 BETWEEN 1 AND 5),
  comment TEXT
);

GRANT SELECT, INSERT ON public.responses TO anon, authenticated;
GRANT ALL ON public.responses TO service_role;

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert responses"
  ON public.responses FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can read responses"
  ON public.responses FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX responses_submitted_at_idx ON public.responses (submitted_at DESC);