-- Migration 003 : authentification par mot de passe + session token
-- Corrige VUL-01 (X-Username spoofing) et VUL-02 (anon role exposing data).
--
-- Modèle :
--   * Chaque utilisateur a un password_hash bcrypt (pgcrypto)
--   * Login retourne un token aléatoire 256 bits (hex) stocké hashé en SHA-256
--   * Le client envoie Authorization: Bearer <token> à chaque requête
--   * api.current_user_id() résout le token contre api.sessions
--   * Plus aucune confiance dans le header X-Username (qui n'est plus utilisé)
--
-- Compatibilité : les utilisateurs existants ont password_hash NULL après cette
-- migration. Ils doivent appeler api.bootstrap_password() une seule fois pour
-- définir leur mot de passe (one-shot, possible uniquement si hash est NULL).
--
-- Appliquer :
--   docker exec -i <container_postgres> psql -U postgres -d hevy_viz < db/migrations/03_session_auth.sql

BEGIN;

-- ── Extension pour bcrypt et random bytes ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Schema modifications ─────────────────────────────────────────────────────
ALTER TABLE api.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS api.sessions (
  token_hash   BYTEA       PRIMARY KEY,
  user_id      INT         NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON api.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON api.sessions(expires_at);

-- ── current_user_id : valide le Bearer token plutôt que X-Username ──────────
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

-- ── Helpers internes (non exposés) ───────────────────────────────────────────
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

-- ── RPC publiques : register / login / logout / bootstrap_password ──────────
CREATE OR REPLACE FUNCTION api.register(
  uname  TEXT,
  dname  TEXT,
  pwd    TEXT
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
    -- Délai constant pour limiter le timing oracle
    PERFORM pg_sleep(0.2);
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  RETURN QUERY
    SELECT api._issue_token(u.id), u.id, u.username, u.display_name;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

-- bootstrap_password : permet aux users existants (password_hash NULL après
-- migration) de définir leur mot de passe une seule fois, sans authentification
-- préalable. Une fois défini, login() est obligatoire.
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

-- change_password : pour user déjà authentifié, vérifie l'ancien et impose le nouveau
CREATE OR REPLACE FUNCTION api.change_password(
  old_pwd TEXT,
  new_pwd TEXT
) RETURNS VOID AS $$
DECLARE
  uid INT := api.current_user_id();
  u   RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF new_pwd IS NULL OR length(new_pwd) < 8 THEN
    RAISE EXCEPTION 'New password too short (min 8 chars)';
  END IF;

  SELECT password_hash INTO u FROM api.users WHERE id = uid;
  IF u.password_hash IS NULL OR u.password_hash <> crypt(old_pwd, u.password_hash) THEN
    PERFORM pg_sleep(0.2);
    RAISE EXCEPTION 'Invalid current password';
  END IF;

  UPDATE api.users SET password_hash = crypt(new_pwd, gen_salt('bf', 10)) WHERE id = uid;
  -- Invalide toutes les autres sessions pour forcer reconnexion
  DELETE FROM api.sessions
   WHERE user_id = uid
     AND token_hash <> digest(
           substring(current_setting('request.headers', true)::json->>'authorization' from 8),
           'sha256'
         );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

-- ── Vue publique des users (sans password_hash) ─────────────────────────────
-- Permet à anon de lister les users pour le picker, sans exposer les hashs.
CREATE OR REPLACE VIEW api.users_public AS
  SELECT id, username, display_name, created_at,
         (password_hash IS NOT NULL) AS has_password
    FROM api.users;

-- ── Permissions / Grants ─────────────────────────────────────────────────────
-- On ne s'appuie plus sur web_user (celui qui était le rôle PGRST_DB_ANON_ROLE
-- exposant tout). Toutes les requêtes arrivent en tant qu'anon. L'autorisation
-- réelle se fait dans current_user_id() + RLS.

-- anon perd l'accès direct à la table users (qui contient password_hash) et
-- l'accède via la vue users_public uniquement.
REVOKE ALL ON api.users FROM anon;
GRANT SELECT ON api.users_public TO anon;

-- anon peut appeler les RPC d'auth
GRANT EXECUTE ON FUNCTION api.register(TEXT, TEXT, TEXT)         TO anon;
GRANT EXECUTE ON FUNCTION api.login(TEXT, TEXT)                  TO anon;
GRANT EXECUTE ON FUNCTION api.bootstrap_password(TEXT, TEXT)     TO anon;
GRANT EXECUTE ON FUNCTION api.logout()                           TO anon;
GRANT EXECUTE ON FUNCTION api.change_password(TEXT, TEXT)        TO anon;
GRANT EXECUTE ON FUNCTION api.whoami()                           TO anon;

-- anon peut accéder aux tables de données (filtrage par RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON api.workout_sets               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.measurements               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.inbody_scans               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.exercise_mapping_overrides TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO anon;

-- anon peut appeler les RPC d'import existantes
GRANT EXECUTE ON FUNCTION api.import_workout_sets(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION api.import_measurements(JSONB) TO anon;

-- ── RLS : on bascule toutes les policies sur le rôle anon ───────────────────
-- Drop des anciennes policies (web_user) si présentes
DROP POLICY IF EXISTS workout_sets_isolation ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_read      ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_write     ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_update    ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_delete    ON api.workout_sets;

DROP POLICY IF EXISTS measurements_isolation ON api.measurements;
DROP POLICY IF EXISTS measurements_read      ON api.measurements;
DROP POLICY IF EXISTS measurements_write     ON api.measurements;
DROP POLICY IF EXISTS measurements_update    ON api.measurements;
DROP POLICY IF EXISTS measurements_delete    ON api.measurements;

DROP POLICY IF EXISTS mapping_isolation      ON api.exercise_mapping_overrides;

DROP POLICY IF EXISTS inbody_scans_isolation ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_read      ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_write     ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_update    ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_delete    ON api.inbody_scans;

-- RLS doit être active sur inbody_scans aussi (oubli historique potentiel)
ALTER TABLE api.inbody_scans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.workout_sets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.measurements                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.exercise_mapping_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.sessions                      ENABLE ROW LEVEL SECURITY;

-- Sessions : invisibles depuis l'API (gérées uniquement par les RPC SECURITY DEFINER)
CREATE POLICY sessions_deny_all ON api.sessions
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- workout_sets / measurements / inbody_scans : lecture libre entre users
-- authentifiés (feature « comparer entre potes »), écriture isolée. Toute
-- requête sans token valide (current_user_id IS NULL) est refusée.
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

CREATE POLICY inbody_scans_read ON api.inbody_scans
  FOR SELECT TO anon USING (api.current_user_id() IS NOT NULL);
CREATE POLICY inbody_scans_write ON api.inbody_scans
  FOR INSERT TO anon WITH CHECK (user_id = api.current_user_id());
CREATE POLICY inbody_scans_update ON api.inbody_scans
  FOR UPDATE TO anon
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
CREATE POLICY inbody_scans_delete ON api.inbody_scans
  FOR DELETE TO anon USING (user_id = api.current_user_id());

-- exercise_mapping_overrides reste totalement privé
CREATE POLICY mapping_isolation ON api.exercise_mapping_overrides
  FOR ALL TO anon
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());

COMMIT;
