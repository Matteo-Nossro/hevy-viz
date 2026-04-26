-- Import batch de workout sets avec dédup native (ON CONFLICT DO NOTHING)
-- Retourne { added, duplicates, total } pour le toast frontend
CREATE OR REPLACE FUNCTION api.import_workout_sets(rows JSONB)
RETURNS TABLE(added INT, duplicates INT, total INT) AS $$
DECLARE
  uid          INT := api.current_user_id();
  before_count BIGINT;
  after_count  BIGINT;
  input_count  INT := jsonb_array_length(rows);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No user context — X-Username header manquant ou invalide';
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
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api;

GRANT EXECUTE ON FUNCTION api.import_workout_sets(JSONB) TO web_user;

-- Import batch de mesures avec dédup native
CREATE OR REPLACE FUNCTION api.import_measurements(rows JSONB)
RETURNS TABLE(added INT, duplicates INT, total INT) AS $$
DECLARE
  uid          INT := api.current_user_id();
  before_count BIGINT;
  after_count  BIGINT;
  input_count  INT := jsonb_array_length(rows);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No user context — X-Username header manquant ou invalide';
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
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = api;

GRANT EXECUTE ON FUNCTION api.import_measurements(JSONB) TO web_user;
