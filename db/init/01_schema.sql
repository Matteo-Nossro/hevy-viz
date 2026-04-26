-- Schéma applicatif séparé du public pour PostgREST
CREATE SCHEMA IF NOT EXISTS api;

-- Rôles PostgREST
-- anon     : requêtes non authentifiées (lecture/création users)
-- web_user : toutes les requêtes après sélection d'un utilisateur
-- authenticator : rôle de connexion pour PostgREST (password fixé par 04_set_password.sh)
CREATE ROLE anon NOLOGIN;
CREATE ROLE web_user NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'init_placeholder_overridden_by_04_sh';
GRANT anon TO authenticator;
GRANT web_user TO authenticator;

-- Tables
CREATE TABLE api.users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(50) UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
  display_name VARCHAR(100),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

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

-- Permissions schéma
GRANT USAGE ON SCHEMA api TO web_user, anon;

-- anon : liste et création des users uniquement
GRANT SELECT, INSERT ON api.users TO anon;
GRANT USAGE ON SEQUENCE api.users_id_seq TO anon;

-- web_user : accès complet aux tables de données (filtré par RLS)
GRANT ALL ON api.users TO web_user;
GRANT ALL ON api.workout_sets TO web_user;
GRANT ALL ON api.measurements TO web_user;
GRANT ALL ON api.exercise_mapping_overrides TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO web_user;
