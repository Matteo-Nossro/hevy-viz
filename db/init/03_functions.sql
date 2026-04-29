-- Fonctions RPC exposées via PostgREST sous le rôle anon.
-- Authentification : register / login / logout / bootstrap_password / change_password
-- Imports batch : import_workout_sets / import_measurements

-- ── Helpers internes ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api._issue_token(uid INT)
RETURNS TEXT AS $$
DECLARE
  raw_token TEXT;
BEGIN
  raw_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO api.sessions (token_hash, user_id)
  VALUES (digest(raw_token, 'sha256'), uid);
  RETURN raw_token;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

REVOKE ALL ON FUNCTION api._issue_token(INT) FROM PUBLIC;

-- ── Auth : register ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.register(
  uname TEXT,
  dname TEXT,
  pwd   TEXT
) RETURNS TABLE(token TEXT, user_id INT, username TEXT, display_name TEXT) AS $$
DECLARE
  new_id INT;
BEGIN
  IF uname IS NULL OR uname !~ '^[a-zA-Z0-9_-]{3,50}$' THEN
    RAISE EXCEPTION 'Invalid username (3-50 chars, alnum/_/-)';
  END IF;
  IF pwd IS NULL OR length(pwd) < 8 THEN
    RAISE EXCEPTION 'Password too short (min 8 chars)';
  END IF;

  INSERT INTO api.users (username, display_name, password_hash)
  VALUES (uname, NULLIF(trim(dname), ''), crypt(pwd, gen_salt('bf', 10)))
  RETURNING id INTO new_id;

  RETURN QUERY
    SELECT api._issue_token(new_id), new_id, uname,
           (SELECT u.display_name FROM api.users u WHERE u.id = new_id);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.register(TEXT, TEXT, TEXT) TO anon;

-- ── Auth : login ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.login(
  uname TEXT,
  pwd   TEXT
) RETURNS TABLE(token TEXT, user_id INT, username TEXT, display_name TEXT) AS $$
DECLARE
  u RECORD;
BEGIN
  SELECT id, api.users.username, api.users.display_name, password_hash
    INTO u
    FROM api.users
   WHERE api.users.username = uname;

  IF u IS NULL OR u.password_hash IS NULL
     OR u.password_hash <> crypt(pwd, u.password_hash) THEN
    PERFORM pg_sleep(0.2);
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  RETURN QUERY
    SELECT api._issue_token(u.id), u.id, u.username, u.display_name;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.login(TEXT, TEXT) TO anon;

-- ── Auth : bootstrap_password ───────────────────────────────────────────────
-- One-shot pour les users créés avant l'introduction de l'auth (password_hash NULL).
CREATE OR REPLACE FUNCTION api.bootstrap_password(
  uname TEXT,
  pwd   TEXT
) RETURNS TABLE(token TEXT, user_id INT, username TEXT, display_name TEXT) AS $$
DECLARE
  u RECORD;
BEGIN
  IF pwd IS NULL OR length(pwd) < 8 THEN
    RAISE EXCEPTION 'Password too short (min 8 chars)';
  END IF;

  SELECT id, api.users.username, api.users.display_name, password_hash
    INTO u
    FROM api.users
   WHERE api.users.username = uname;

  IF u IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF u.password_hash IS NOT NULL THEN
    RAISE EXCEPTION 'Password already set, use login()';
  END IF;

  UPDATE api.users
     SET password_hash = crypt(pwd, gen_salt('bf', 10))
   WHERE id = u.id;

  RETURN QUERY
    SELECT api._issue_token(u.id), u.id, u.username, u.display_name;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.bootstrap_password(TEXT, TEXT) TO anon;

-- ── Auth : whoami (validation de session au démarrage du client) ───────────
CREATE OR REPLACE FUNCTION api.whoami()
RETURNS TABLE(user_id INT, username TEXT, display_name TEXT) AS $$
DECLARE
  uid INT := api.current_user_id();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id, u.username::TEXT, u.display_name::TEXT
      FROM api.users u
     WHERE u.id = uid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.whoami() TO anon;

-- ── Auth : logout ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.logout() RETURNS VOID AS $$
DECLARE
  hdr TEXT;
  tok TEXT;
BEGIN
  hdr := current_setting('request.headers', true)::json->>'authorization';
  IF hdr IS NULL OR position('Bearer ' in hdr) <> 1 THEN RETURN; END IF;
  tok := substring(hdr from 8);
  DELETE FROM api.sessions WHERE token_hash = digest(tok, 'sha256');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.logout() TO anon;

-- ── Auth : change_password ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.change_password(
  old_pwd TEXT,
  new_pwd TEXT
) RETURNS VOID AS $$
DECLARE
  uid     INT := api.current_user_id();
  hash    TEXT;
  cur_tok TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF new_pwd IS NULL OR length(new_pwd) < 8 THEN
    RAISE EXCEPTION 'New password too short (min 8 chars)';
  END IF;

  SELECT password_hash INTO hash FROM api.users WHERE id = uid;
  IF hash IS NULL OR hash <> crypt(old_pwd, hash) THEN
    PERFORM pg_sleep(0.2);
    RAISE EXCEPTION 'Invalid current password';
  END IF;

  UPDATE api.users SET password_hash = crypt(new_pwd, gen_salt('bf', 10)) WHERE id = uid;

  -- Invalide toutes les autres sessions, garde la session courante
  cur_tok := substring(current_setting('request.headers', true)::json->>'authorization' from 8);
  DELETE FROM api.sessions
   WHERE user_id = uid
     AND token_hash <> digest(cur_tok, 'sha256');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.change_password(TEXT, TEXT) TO anon;

-- ── Import batch de workout sets avec dédup native ──────────────────────────
CREATE OR REPLACE FUNCTION api.import_workout_sets(rows JSONB)
RETURNS TABLE(added INT, duplicates INT, total INT) AS $$
DECLARE
  uid          INT := api.current_user_id();
  before_count BIGINT;
  after_count  BIGINT;
  input_count  INT := jsonb_array_length(rows);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO before_count FROM api.workout_sets WHERE user_id = uid;

  INSERT INTO api.workout_sets (
    user_id, title, start_time, end_time, description,
    exercise_title, superset_id, exercise_notes, set_index,
    set_type, weight_kg, reps, distance_km, duration_seconds, rpe
  )
  SELECT
    uid,
    r->>'title',
    (r->>'start_time')::TIMESTAMPTZ,
    NULLIF(r->>'end_time', '')::TIMESTAMPTZ,
    NULLIF(r->>'description', ''),
    r->>'exercise_title',
    NULLIF(r->>'superset_id', ''),
    NULLIF(r->>'exercise_notes', ''),
    (r->>'set_index')::INT,
    NULLIF(r->>'set_type', ''),
    NULLIF(r->>'weight_kg', '')::NUMERIC,
    NULLIF(r->>'reps', '')::INT,
    NULLIF(r->>'distance_km', '')::NUMERIC,
    NULLIF(r->>'duration_seconds', '')::INT,
    NULLIF(r->>'rpe', '')::NUMERIC
  FROM jsonb_array_elements(rows) AS r
  ON CONFLICT ON CONSTRAINT workout_sets_unique DO NOTHING;

  SELECT COUNT(*) INTO after_count FROM api.workout_sets WHERE user_id = uid;

  added      := after_count - before_count;
  duplicates := input_count - added;
  total      := after_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.import_workout_sets(JSONB) TO anon;

-- ── Import batch de mesures avec dédup native ───────────────────────────────
CREATE OR REPLACE FUNCTION api.import_measurements(rows JSONB)
RETURNS TABLE(added INT, duplicates INT, total INT) AS $$
DECLARE
  uid          INT := api.current_user_id();
  before_count BIGINT;
  after_count  BIGINT;
  input_count  INT := jsonb_array_length(rows);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO before_count FROM api.measurements WHERE user_id = uid;

  INSERT INTO api.measurements (
    user_id, date, weight_kg, fat_percent, neck_cm, shoulder_cm, chest_cm,
    left_bicep_cm, right_bicep_cm, left_forearm_cm, right_forearm_cm,
    abdomen_cm, waist_cm, hips_cm, left_thigh_cm, right_thigh_cm,
    left_calf_cm, right_calf_cm
  )
  SELECT
    uid,
    (r->>'date')::TIMESTAMPTZ,
    NULLIF(r->>'weight_kg', '')::NUMERIC,
    NULLIF(r->>'fat_percent', '')::NUMERIC,
    NULLIF(r->>'neck_cm', '')::NUMERIC,
    NULLIF(r->>'shoulder_cm', '')::NUMERIC,
    NULLIF(r->>'chest_cm', '')::NUMERIC,
    NULLIF(r->>'left_bicep_cm', '')::NUMERIC,
    NULLIF(r->>'right_bicep_cm', '')::NUMERIC,
    NULLIF(r->>'left_forearm_cm', '')::NUMERIC,
    NULLIF(r->>'right_forearm_cm', '')::NUMERIC,
    NULLIF(r->>'abdomen_cm', '')::NUMERIC,
    NULLIF(r->>'waist_cm', '')::NUMERIC,
    NULLIF(r->>'hips_cm', '')::NUMERIC,
    NULLIF(r->>'left_thigh_cm', '')::NUMERIC,
    NULLIF(r->>'right_thigh_cm', '')::NUMERIC,
    NULLIF(r->>'left_calf_cm', '')::NUMERIC,
    NULLIF(r->>'right_calf_cm', '')::NUMERIC
  FROM jsonb_array_elements(rows) AS r
  ON CONFLICT ON CONSTRAINT measurements_unique DO NOTHING;

  SELECT COUNT(*) INTO after_count FROM api.measurements WHERE user_id = uid;

  added      := after_count - before_count;
  duplicates := input_count - added;
  total      := after_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

GRANT EXECUTE ON FUNCTION api.import_measurements(JSONB) TO anon;
