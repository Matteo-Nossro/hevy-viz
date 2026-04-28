-- Migration 002 : ouverture de la lecture cross-user
-- workout_sets, measurements et inbody_scans deviennent lisibles par tous les
-- utilisateurs authentifiés (pour la comparaison entre potes).
-- L'écriture reste strictement isolée au user courant via RLS.
-- exercise_mapping_overrides reste entièrement privé (préférence personnelle).
--
-- Appliquer sur l'instance déployée :
--   docker exec -i <container_postgres> psql -U postgres -d hevyviz < db/migrations/02_open_read_access.sql

-- Drop des policies existantes (isolation totale) et des nouvelles (idempotence)
DROP POLICY IF EXISTS workout_sets_isolation ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_read     ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_write    ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_update   ON api.workout_sets;
DROP POLICY IF EXISTS workout_sets_delete   ON api.workout_sets;

DROP POLICY IF EXISTS measurements_isolation ON api.measurements;
DROP POLICY IF EXISTS measurements_read      ON api.measurements;
DROP POLICY IF EXISTS measurements_write     ON api.measurements;
DROP POLICY IF EXISTS measurements_update    ON api.measurements;
DROP POLICY IF EXISTS measurements_delete    ON api.measurements;

DROP POLICY IF EXISTS mapping_isolation ON api.exercise_mapping_overrides;

DROP POLICY IF EXISTS inbody_scans_isolation ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_read      ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_write     ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_update    ON api.inbody_scans;
DROP POLICY IF EXISTS inbody_scans_delete    ON api.inbody_scans;

-- workout_sets : lecture libre pour tous les users authentifiés, écriture isolée
CREATE POLICY workout_sets_read ON api.workout_sets
  FOR SELECT TO web_user USING (true);
CREATE POLICY workout_sets_write ON api.workout_sets
  FOR INSERT TO web_user WITH CHECK (user_id = api.current_user_id());
CREATE POLICY workout_sets_update ON api.workout_sets
  FOR UPDATE TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
CREATE POLICY workout_sets_delete ON api.workout_sets
  FOR DELETE TO web_user USING (user_id = api.current_user_id());

-- measurements : lecture libre, écriture isolée
CREATE POLICY measurements_read ON api.measurements
  FOR SELECT TO web_user USING (true);
CREATE POLICY measurements_write ON api.measurements
  FOR INSERT TO web_user WITH CHECK (user_id = api.current_user_id());
CREATE POLICY measurements_update ON api.measurements
  FOR UPDATE TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
CREATE POLICY measurements_delete ON api.measurements
  FOR DELETE TO web_user USING (user_id = api.current_user_id());

-- inbody_scans : lecture libre, écriture isolée
CREATE POLICY inbody_scans_read ON api.inbody_scans
  FOR SELECT TO web_user USING (true);
CREATE POLICY inbody_scans_write ON api.inbody_scans
  FOR INSERT TO web_user WITH CHECK (user_id = api.current_user_id());
CREATE POLICY inbody_scans_update ON api.inbody_scans
  FOR UPDATE TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
CREATE POLICY inbody_scans_delete ON api.inbody_scans
  FOR DELETE TO web_user USING (user_id = api.current_user_id());

-- exercise_mapping_overrides : reste entièrement privé (préférence personnelle,
-- pas une donnée d'entraînement partageable)
CREATE POLICY mapping_isolation ON api.exercise_mapping_overrides
  FOR ALL TO web_user
  USING (user_id = api.current_user_id())
  WITH CHECK (user_id = api.current_user_id());
