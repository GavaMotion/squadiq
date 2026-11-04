-- In-app feedback from the rating card ("Tell us what to improve").
--
-- The rating card offers two equal choices: rate on Google Play, or send a
-- note here. Nobody is screened out of rating (both stores forbid gating), but
-- a coach with a complaint gets a direct line to us instead of the store.
--
-- Coaches can only insert their own notes; nobody reads them from the app.
-- The admin board reads them with the service role.

CREATE TABLE IF NOT EXISTS public.app_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id     uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  message     text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  source      text NOT NULL DEFAULT 'rating-card' CHECK (char_length(source) <= 40),
  platform    text CHECK (char_length(platform) <= 20),
  app_version text CHECK (char_length(app_version) <= 40),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_feedback_created_idx ON public.app_feedback (created_at DESC);

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_feedback_insert_own ON public.app_feedback;
CREATE POLICY app_feedback_insert_own ON public.app_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.app_feedback FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.app_feedback FROM authenticated;
GRANT INSERT ON public.app_feedback TO authenticated;

NOTIFY pgrst, 'reload schema';
