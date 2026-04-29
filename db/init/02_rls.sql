-- Row Level Security : toutes les tables de données sont accédées via le rôle
-- anon (PGRST_DB_ANON_ROLE=anon). L'autorisation est portée par
-- api.current_user_id() qui résout le header Authorization: Bearer <token>
-- contre la table api.sessions.

ALTER TABLE api.workout_sets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.measurements               ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.exercise_mapping_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.sessions                   ENABLE ROW LEVEL SECURITY;

-- ── Identité : résolution du Bearer token vers user_id ──────────────────────
CREATE OR REPLACE FUNCTION api.current_user_id() RETURNS INT AS $$
DECLARE
  hdr  TEXT;
  tok  TEXT;
  th   BYTEA;
  uid  INT;
BEGIN
  hdr := current_setting('request.headers', true)::json->>'authorization';
  IF hdr IS NULL OR position('Bearer ' in hdr) <> 1 THEN
    RETURN NULL;
  END IF;
  tok := substring(hdr from 8);
  IF length(tok) < 32 THEN RETURN NULL; END IF;
  th  := digest(tok, 'sha256');

  SELECT s.user_id INTO uid
    FROM api.sessions s
   WHERE s.token_hash = th
     AND s.expires_at > NOW();

  RETURN uid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = api, pg_catalog;

-- ── Policies ─────────────────────────────────────────────────────────────────
-- workout_sets / measurements : lecture cross-user (feature « comparer entre
-- potes »), écriture isolée. Un client sans token valide est bloqué partout.

CREATE POLICY workout_sets_read ON api.workout_sets
  FOR SELECT TO anon USING (api.current_user_id() IS NOT NULL);
CREATE POLICY workout_sets_write ON api.workout_sets
  FOR INSERT TO anon WITH CHECK (user_id = api.current_user_id());
CREATE POLICY workout_sets_update ON api.workout_sets
  FOR UPDATE TO anon
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
CREATE POLICY workout_sets_delete ON api.workout_sets
  FOR DELETE TO anon USING (user_id = api.current_user_id());

CREATE POLICY measurements_read ON api.measurements
  FOR SELECT TO anon USING (api.current_user_id() IS NOT NULL);
CREATE POLICY measurements_write ON api.measurements
  FOR INSERT TO anon WITH CHECK (user_id = api.current_user_id());
CREATE POLICY measurements_update ON api.measurements
  FOR UPDATE TO anon
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
CREATE POLICY measurements_delete ON api.measurements
  FOR DELETE TO anon USING (user_id = api.current_user_id());

-- exercise_mapping_overrides : strictement privé (préférence personnelle)
CREATE POLICY mapping_isolation ON api.exercise_mapping_overrides
  FOR ALL TO anon
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());

-- sessions : invisibles côté API, gérées uniquement par les RPC SECURITY DEFINER
CREATE POLICY sessions_deny_all ON api.sessions
  FOR ALL TO anon USING (false) WITH CHECK (false);
