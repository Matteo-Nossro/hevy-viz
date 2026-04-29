-- Schéma applicatif séparé du public pour PostgREST
CREATE SCHEMA IF NOT EXISTS api;

-- Extension pour bcrypt (crypt/gen_salt) et random bytes (gen_random_bytes)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Rôles PostgREST
-- anon          : rôle assumé par TOUTES les requêtes (PGRST_DB_ANON_ROLE=anon).
--                 L'identité réelle est portée par Authorization: Bearer <token>
--                 et résolue par api.current_user_id() contre api.sessions.
-- authenticator : rôle de connexion pour PostgREST (password fixé par 04_set_password.sh)
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'init_placeholder_overridden_by_04_sh';
GRANT anon TO authenticator;

-- Tables
CREATE TABLE api.users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
  display_name  VARCHAR(100),
  password_hash TEXT,                          -- bcrypt via pgcrypto
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions : tokens de session (32 octets aléatoires hex), stockés hashés SHA-256
CREATE TABLE api.sessions (
  token_hash   BYTEA       PRIMARY KEY,
  user_id      INT         NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id    ON api.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON api.sessions(expires_at);

CREATE TABLE api.workout_sets (
  id               BIGSERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  description      TEXT,
  exercise_title   TEXT NOT NULL,
  superset_id      TEXT,
  exercise_notes   TEXT,
  set_index        INT NOT NULL,
  set_type         VARCHAR(20),
  weight_kg        NUMERIC(8,2),
  reps             INT,
  distance_km      NUMERIC(8,3),
  duration_seconds INT,
  rpe              NUMERIC(3,1),
  CONSTRAINT workout_sets_unique UNIQUE (user_id, title, start_time, exercise_title, set_index)
);
CREATE INDEX idx_workout_sets_user_time ON api.workout_sets(user_id, start_time DESC);

CREATE TABLE api.measurements (
  id               BIGSERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  date             TIMESTAMPTZ NOT NULL,
  weight_kg        NUMERIC(6,2),
  fat_percent      NUMERIC(4,2),
  neck_cm          NUMERIC(5,2),
  shoulder_cm      NUMERIC(5,2),
  chest_cm         NUMERIC(5,2),
  left_bicep_cm    NUMERIC(5,2),
  right_bicep_cm   NUMERIC(5,2),
  left_forearm_cm  NUMERIC(5,2),
  right_forearm_cm NUMERIC(5,2),
  abdomen_cm       NUMERIC(5,2),
  waist_cm         NUMERIC(5,2),
  hips_cm          NUMERIC(5,2),
  left_thigh_cm    NUMERIC(5,2),
  right_thigh_cm   NUMERIC(5,2),
  left_calf_cm     NUMERIC(5,2),
  right_calf_cm    NUMERIC(5,2),
  CONSTRAINT measurements_unique UNIQUE (user_id, date)
);
CREATE INDEX idx_measurements_user_date ON api.measurements(user_id, date DESC);

CREATE TABLE api.exercise_mapping_overrides (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  exercise_title TEXT NOT NULL,
  muscle_groups  TEXT[] NOT NULL,
  CONSTRAINT mapping_unique UNIQUE (user_id, exercise_title)
);

-- Vue publique sur users (sans password_hash) — exposée à anon
CREATE VIEW api.users_public AS
  SELECT id, username, display_name, created_at,
         (password_hash IS NOT NULL) AS has_password
    FROM api.users;

-- Permissions schéma
GRANT USAGE ON SCHEMA api TO anon;

-- anon : aucun accès direct à api.users (qui contient password_hash).
--        Lecture via la vue users_public uniquement.
GRANT SELECT ON api.users_public TO anon;

-- anon : accès aux tables de données — filtrage assuré par RLS (cf. 02_rls.sql)
GRANT SELECT, INSERT, UPDATE, DELETE ON api.workout_sets               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.measurements               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.exercise_mapping_overrides TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO anon;

-- api.sessions : aucun GRANT direct, uniquement via les RPC SECURITY DEFINER
