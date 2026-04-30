-- Migration 004 : basculer la résolution d'identité de Authorization: Bearer
-- vers le header X-Session-Token (ne passe plus par PostgREST JWT validation).
--
-- Contexte : commit eb622c4 a changé le frontend et nginx pour utiliser
-- X-Session-Token au lieu de Authorization: Bearer, mais les fonctions DB
-- n'avaient pas été mises à jour → current_user_id() retournait toujours NULL
-- → toutes les policies RLS refusaient → HTTP 500 sur toutes les requêtes.
--
-- Appliquer :
--   docker exec -i <container_postgres> psql -U <POSTGRES_USER> -d <POSTGRES_DB> \
--     < db/migrations/04_x_session_token.sql

BEGIN;

-- ── current_user_id : lit x-session-token au lieu de authorization ───────────
CREATE OR REPLACE FUNCTION api.current_user_id() RETURNS INT AS $$
DECLARE
  tok  TEXT;
  th   BYTEA;
  uid  INT;
BEGIN
  tok := current_setting('request.headers', true)::json->>'x-session-token';
  IF tok IS NULL OR length(tok) < 32 THEN RETURN NULL; END IF;
  th  := digest(tok, 'sha256');

  SELECT s.user_id INTO uid
    FROM api.sessions s
   WHERE s.token_hash = th
     AND s.expires_at > NOW();

  RETURN uid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = api, pg_catalog;

-- ── logout : lit x-session-token au lieu de authorization ───────────────────
CREATE OR REPLACE FUNCTION api.logout() RETURNS VOID AS $$
DECLARE
  tok TEXT;
BEGIN
  tok := current_setting('request.headers', true)::json->>'x-session-token';
  IF tok IS NULL THEN RETURN; END IF;
  DELETE FROM api.sessions WHERE token_hash = digest(tok, 'sha256');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

-- ── change_password : lit x-session-token pour identifier la session courante
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

  cur_tok := current_setting('request.headers', true)::json->>'x-session-token';
  DELETE FROM api.sessions
   WHERE user_id = uid
     AND token_hash <> digest(cur_tok, 'sha256');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api, pg_catalog;

COMMIT;
