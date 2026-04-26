-- Active RLS sur toutes les tables avec données utilisateur
ALTER TABLE api.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.exercise_mapping_overrides ENABLE ROW LEVEL SECURITY;

-- Helper : récupère l'id de l'utilisateur courant depuis le header X-Username
-- PostgREST injecte les headers HTTP dans request.headers (JSON)
CREATE OR REPLACE FUNCTION api.current_user_id() RETURNS INT AS $$
DECLARE
  uname TEXT;
  uid   INT;
BEGIN
  uname := current_setting('request.headers', true)::json->>'x-username';
  IF uname IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO uid FROM api.users WHERE username = uname;
  RETURN uid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Policies : chaque utilisateur ne voit et ne modifie que ses propres lignes
CREATE POLICY workout_sets_isolation ON api.workout_sets
  FOR ALL TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());

CREATE POLICY measurements_isolation ON api.measurements
  FOR ALL TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());

CREATE POLICY mapping_isolation ON api.exercise_mapping_overrides
  FOR ALL TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
